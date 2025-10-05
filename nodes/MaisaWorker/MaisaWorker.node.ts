import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IDataObject,
	IBinaryKeyData,
	IBinaryData,
	IHttpRequestMethods,
} from 'n8n-workflow';

import FormData from 'form-data';

export class MaisaWorker implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Maisa Worker',
		name: 'maisaWorker',
		icon: 'file:maisaworker.svg',
		group: ['transform'],
		version: 1,
		description: 'Run Maisa Worker and stream execution steps in real-time',
		defaults: {
			name: 'Maisa Worker',
		},
		inputs: ['main'],
		outputs: ['main', 'main'],
		outputNames: ['Steps', 'Final Result'],
		properties: [
			{
				displayName: 'Worker URL',
				name: 'baseUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://studio-api.maisa.ai/deployed/YOUR_WORKER_ID/run',
				description: 'The full URL of your Maisa Worker endpoint',
			},
			{
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				required: true,
				description: 'The API key for this specific worker (ms-api-key header)',
			},
			{
				displayName: 'Input Variables',
				name: 'inputVariables',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add Variable',
				options: [
					{
						name: 'variable',
						displayName: 'Variable',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the input variable',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the input variable',
							},
						],
					},
				],
				description: 'Input variables to pass to the worker',
			},
			{
				displayName: 'Files',
				name: 'files',
				type: 'string',
				default: '',
				description: 'Binary property name containing files to upload (comma-separated for multiple)',
			},
			{
				displayName: 'Polling Interval (seconds)',
				name: 'pollingInterval',
				type: 'number',
				default: 5,
				description: 'How often to check for status updates',
			},
			{
				displayName: 'Timeout (seconds)',
				name: 'timeout',
				type: 'number',
				default: 300,
				description: 'Maximum time to wait for completion',
			},
			{
				displayName: 'Auto Download Files',
				name: 'autoDownloadFiles',
				type: 'boolean',
				default: true,
				description: 'Whether to automatically download output files when execution completes',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const stepsOutput: INodeExecutionData[] = [];
		const finalOutput: INodeExecutionData[] = [];
		
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string;
		const apiKey = this.getNodeParameter('apiKey', 0) as string;
		const pollingInterval = this.getNodeParameter('pollingInterval', 0) as number;
		const timeout = this.getNodeParameter('timeout', 0) as number;
		const autoDownloadFiles = this.getNodeParameter('autoDownloadFiles', 0) as boolean;

		for (let i = 0; i < items.length; i++) {
			try {
				// 1. Start worker execution
				const runResult = await runWorker.call(this, i, baseUrl, apiKey);
				const executionId = runResult.data as string;
				
				// 2. Poll for status updates and emit each step
				const startTime = Date.now();
				let isComplete = false;
				let finalStatus: IDataObject = {};
				
				while (!isComplete) {
					// Check timeout
					if ((Date.now() - startTime) / 1000 > timeout) {
						throw new NodeOperationError(this.getNode(), `Execution timed out after ${timeout} seconds`);
					}
					
					// Get current status
					const status = await getStatus.call(this, executionId, baseUrl, apiKey);
					
					// Emit step output
					stepsOutput.push({
						json: {
							executionId,
							status: status.data || status,
							timestamp: new Date().toISOString(),
						},
					});
					
					// Check if complete
					const statusData = status.data as IDataObject;
					if (statusData && (statusData.status === 'completed' || statusData.status === 'failed' || statusData.status === 'error')) {
						isComplete = true;
						finalStatus = statusData;
					}
					
					if (!isComplete) {
						// Wait before next poll
						await new Promise(resolve => setTimeout(resolve, pollingInterval * 1000));
					}
				}
				
				// 3. Download files if requested
				let binaryFiles: IBinaryKeyData | undefined;
				let filesList: IDataObject[] = [];
				
				if (autoDownloadFiles && finalStatus.status === 'completed') {
					const downloadedFiles = await downloadAllFiles.call(this, executionId, baseUrl, apiKey, i);
					binaryFiles = createBinaryData(downloadedFiles);
					filesList = downloadedFiles.map(f => ({ fileName: f.fileName, mimeType: f.mimeType }));
				}
				
				// 4. Emit final result
				finalOutput.push({
					json: {
						executionId,
						status: finalStatus,
						outputFiles: filesList,
						completedAt: new Date().toISOString(),
					},
					binary: binaryFiles,
				});
				
			} catch (error) {
				if (this.continueOnFail()) {
					finalOutput.push({
						json: {
							error: (error as Error).message,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [stepsOutput, finalOutput];
	}
}

async function runWorker(
	this: IExecuteFunctions,
	itemIndex: number,
	baseUrl: string,
	apiKey: string,
): Promise<IDataObject> {
	const inputVariablesData = this.getNodeParameter('inputVariables.variable', itemIndex, []) as IDataObject[];
	const filesProperty = this.getNodeParameter('files', itemIndex, '') as string;

	const formData = new FormData();

	// Add input variables
	const inputVariables = inputVariablesData.map((variable: IDataObject) => ({
		name: variable.name,
		value: variable.value,
	}));
	
	formData.append('inputVariables', JSON.stringify(inputVariables));

	// Add files if specified
	if (filesProperty) {
		const fileProperties = filesProperty.split(',').map(prop => prop.trim());
		
		for (const prop of fileProperties) {
			const binaryData = this.helpers.assertBinaryData(itemIndex, prop);
			const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, prop);
			
			formData.append('files', buffer, {
				filename: binaryData.fileName || 'file',
				contentType: binaryData.mimeType,
			});
		}
	}

	// Clean baseUrl and determine run endpoint
	let cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	const runUrl = cleanBaseUrl.endsWith('/run') ? cleanBaseUrl : `${cleanBaseUrl}/run`;
	
	// Extract base without /run for other endpoints
	if (cleanBaseUrl.endsWith('/run')) {
		cleanBaseUrl = cleanBaseUrl.slice(0, -4);
	}
	
	const options = {
		method: 'POST' as IHttpRequestMethods,
		url: runUrl,
		headers: {
			'ms-api-key': apiKey,
			...formData.getHeaders(),
		},
		formData: {
			inputVariables: JSON.stringify(inputVariables),
		},
	};

	// Add files to formData option if present
	if (filesProperty) {
		const fileProperties = filesProperty.split(',').map(prop => prop.trim());
		const files = [];
		
		for (const prop of fileProperties) {
			const binaryData = this.helpers.assertBinaryData(itemIndex, prop);
			const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, prop);
			
			files.push({
				value: buffer,
				options: {
					filename: binaryData.fileName || 'file',
					contentType: binaryData.mimeType,
				},
			});
		}
		
		(options as any).formData.files = files;
	}

	const response = await this.helpers.request(options);
	return typeof response === 'string' ? JSON.parse(response) : response;
}

async function getStatus(
	this: IExecuteFunctions,
	executionId: string,
	baseUrl: string,
	apiKey: string,
): Promise<IDataObject> {
	// Extract base domain from worker URL
	// From: https://studio-api.maisa.ai/deployed/68dcd2e4eb3b0fa4c9af3aa4/run
	// To: https://studio-api.maisa.ai
	const urlParts = baseUrl.match(/^(https?:\/\/[^\/]+)/);
	const baseDomain = urlParts ? urlParts[1] : baseUrl;
	
	const options = {
		method: 'GET' as IHttpRequestMethods,
		url: `${baseDomain}/runs/${executionId}/detail`,
		headers: {
			'ms-api-key': apiKey,
		},
	};

	const response = await this.helpers.request(options);
	return typeof response === 'string' ? JSON.parse(response) : response;
}

async function listFiles(
	this: IExecuteFunctions,
	executionId: string,
	baseUrl: string,
	apiKey: string,
): Promise<IDataObject> {
	// Extract base domain from worker URL
	const urlParts = baseUrl.match(/^(https?:\/\/[^\/]+)/);
	const baseDomain = urlParts ? urlParts[1] : baseUrl;
	
	const options = {
		method: 'GET' as IHttpRequestMethods,
		url: `${baseDomain}/runs/${executionId}/file/listed?limit=100`,
		headers: {
			'ms-api-key': apiKey,
		},
	};

	const response = await this.helpers.request(options);
	return typeof response === 'string' ? JSON.parse(response) : response;
}

async function downloadFile(
	this: IExecuteFunctions,
	executionId: string,
	fileName: string,
	baseUrl: string,
	apiKey: string,
): Promise<IBinaryData> {
	// Extract base domain from worker URL
	const urlParts = baseUrl.match(/^(https?:\/\/[^\/]+)/);
	const baseDomain = urlParts ? urlParts[1] : baseUrl;
	
	const options = {
		method: 'GET' as IHttpRequestMethods,
		url: `${baseDomain}/runs/${executionId}/file/${fileName}`,
		headers: {
			'ms-api-key': apiKey,
		},
		encoding: null,
	};

	const response = await this.helpers.request(options);
	const buffer = Buffer.isBuffer(response) ? response : Buffer.from(response);
	
	return {
		data: buffer.toString('base64'),
		fileName,
		mimeType: getMimeType(fileName),
	};
}

async function waitForCompletion(
	this: IExecuteFunctions,
	executionId: string,
	baseUrl: string,
	apiKey: string,
	pollingInterval: number,
	timeout: number,
): Promise<IDataObject> {
	const startTime = Date.now();
	const timeoutMs = timeout * 1000;
	const intervalMs = pollingInterval * 1000;

	while (true) {
		const elapsed = Date.now() - startTime;
		if (elapsed > timeoutMs) {
			throw new NodeOperationError(
				this.getNode(),
				`Worker execution timed out after ${timeout} seconds`,
			);
		}

		const status = await getStatus.call(this, executionId, baseUrl, apiKey);
		const statusData = status.data as IDataObject;
		
		// Check if execution is complete (you may need to adjust this based on actual API response)
		if (statusData.result !== null && statusData.result !== undefined && statusData.result !== '') {
			return statusData;
		}

		// Wait before next poll
		await new Promise(resolve => setTimeout(resolve, intervalMs));
	}
}

async function downloadAllFiles(
	this: IExecuteFunctions,
	executionId: string,
	baseUrl: string,
	apiKey: string,
	itemIndex: number,
): Promise<IBinaryData[]> {
	const filesResponse = await listFiles.call(this, executionId, baseUrl, apiKey);
	const filesData = filesResponse.data as IDataObject;
	const outFiles = (filesData.out || []) as IDataObject[];
	
	const downloadedFiles: IBinaryData[] = [];
	
	for (const file of outFiles) {
		const fileName = file.fileName as string;
		const fileData = await downloadFile.call(this, executionId, fileName, baseUrl, apiKey);
		downloadedFiles.push(fileData);
	}
	
	return downloadedFiles;
}

function createBinaryData(files: IBinaryData[]): IBinaryKeyData {
	const binaryData: IBinaryKeyData = {};
	
	files.forEach((file, index) => {
		const propertyName = files.length === 1 ? 'data' : `data${index}`;
		binaryData[propertyName] = {
			data: file.data,
			fileName: file.fileName,
			mimeType: file.mimeType,
		};
	});
	
	return binaryData;
}

function getMimeType(fileName: string): string {
	const extension = fileName.split('.').pop()?.toLowerCase();
	const mimeTypes: { [key: string]: string } = {
		'pdf': 'application/pdf',
		'png': 'image/png',
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'gif': 'image/gif',
		'txt': 'text/plain',
		'json': 'application/json',
		'xml': 'application/xml',
		'csv': 'text/csv',
		'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	};
	
	return mimeTypes[extension || ''] || 'application/octet-stream';
}
