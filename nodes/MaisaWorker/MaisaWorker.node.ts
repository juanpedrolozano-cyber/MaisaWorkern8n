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
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Maisa Worker API to run AI workers and retrieve results',
		defaults: {
			name: 'Maisa Worker',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run Worker',
						value: 'runWorker',
						description: 'Start a worker execution and wait for completion',
						action: 'Run a worker and wait for results',
					},
					{
						name: 'Run Worker (Async)',
						value: 'runWorkerAsync',
						description: 'Start a worker execution without waiting',
						action: 'Run a worker asynchronously',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						description: 'Get the status of a worker execution',
						action: 'Get worker execution status',
					},
					{
						name: 'List Files',
						value: 'listFiles',
						description: 'List files from a worker execution',
						action: 'List execution files',
					},
					{
						name: 'Download File',
						value: 'downloadFile',
						description: 'Download a file from a worker execution',
						action: 'Download a file',
					},
				],
				default: 'runWorker',
			},
			// Base URL
			{
				displayName: 'Worker URL',
				name: 'baseUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://studio-api.maisa.ai/deployed/YOUR_WORKER_ID/run',
				description: 'The full URL of your Maisa Worker endpoint (with or without /run)',
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
			// Run Worker fields
			{
				displayName: 'Input Variables',
				name: 'inputVariables',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						operation: ['runWorker', 'runWorkerAsync'],
					},
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
				displayOptions: {
					show: {
						operation: ['runWorker', 'runWorkerAsync'],
					},
				},
				default: '',
				description: 'Binary property name containing files to upload (comma-separated for multiple)',
			},
			{
				displayName: 'Polling Interval (seconds)',
				name: 'pollingInterval',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['runWorker'],
					},
				},
				default: 5,
				description: 'How often to check for completion (in seconds)',
			},
			{
				displayName: 'Timeout (seconds)',
				name: 'timeout',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['runWorker'],
					},
				},
				default: 300,
				description: 'Maximum time to wait for completion (in seconds)',
			},
			{
				displayName: 'Auto Download Files',
				name: 'autoDownloadFiles',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['runWorker'],
					},
				},
				default: true,
				description: 'Whether to automatically download output files when execution completes',
			},
			// Get Status fields
			{
				displayName: 'Execution ID',
				name: 'executionId',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['getStatus', 'listFiles'],
					},
				},
				default: '',
				required: true,
				description: 'The ID of the worker execution',
			},
			// Download File fields
			{
				displayName: 'Execution ID',
				name: 'executionId',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['downloadFile'],
					},
				},
				default: '',
				required: true,
				description: 'The ID of the worker execution',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['downloadFile'],
					},
				},
				default: '',
				required: true,
				description: 'The name of the file to download',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryProperty',
				type: 'string',
				displayOptions: {
					show: {
						operation: ['downloadFile'],
					},
				},
				default: 'data',
				required: true,
				description: 'Name of the binary property to store the downloaded file',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const baseUrl = this.getNodeParameter('baseUrl', 0) as string;
		const apiKey = this.getNodeParameter('apiKey', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'runWorker' || operation === 'runWorkerAsync') {
					const result = await runWorker.call(this, i, baseUrl, apiKey);
					
					if (operation === 'runWorker') {
						// Wait for completion
						const pollingInterval = this.getNodeParameter('pollingInterval', i) as number;
						const timeout = this.getNodeParameter('timeout', i) as number;
						const autoDownloadFiles = this.getNodeParameter('autoDownloadFiles', i) as boolean;
						
						const executionId = result.data as string;
						const finalResult = await waitForCompletion.call(this, executionId, baseUrl, apiKey, pollingInterval, timeout);
						
						let binaryFiles: IBinaryKeyData | undefined;
						let filesList: IDataObject[] = [];
						if (autoDownloadFiles) {
							const downloadedFiles = await downloadAllFiles.call(this, executionId, baseUrl, apiKey, i);
							binaryFiles = createBinaryData(downloadedFiles);
							filesList = downloadedFiles.map(f => ({ fileName: f.fileName, mimeType: f.mimeType }));
						}
						
						returnData.push({
							json: {
								...finalResult,
								executionId,
								outputFiles: filesList,
							},
							binary: binaryFiles,
						});
					} else {
						returnData.push({ json: result });
					}
					
				} else if (operation === 'getStatus') {
					const executionId = this.getNodeParameter('executionId', i) as string;
					const result = await getStatus.call(this, executionId, baseUrl, apiKey);
					returnData.push({ json: result });
					
				} else if (operation === 'listFiles') {
					const executionId = this.getNodeParameter('executionId', i) as string;
					const result = await listFiles.call(this, executionId, baseUrl, apiKey);
					returnData.push({ json: result });
					
				} else if (operation === 'downloadFile') {
					const executionId = this.getNodeParameter('executionId', i) as string;
					const fileName = this.getNodeParameter('fileName', i) as string;
					const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
					
					const fileData = await downloadFile.call(this, executionId, fileName, baseUrl, apiKey);
					
					returnData.push({
						json: {
							fileName,
							executionId,
						},
						binary: {
							[binaryProperty]: fileData,
						},
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
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
	let cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	if (cleanBaseUrl.endsWith('/run')) {
		cleanBaseUrl = cleanBaseUrl.slice(0, -4);
	}
	
	const options = {
		method: 'GET' as IHttpRequestMethods,
		url: `${cleanBaseUrl}/run/${executionId}`,
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
	let cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	if (cleanBaseUrl.endsWith('/run')) {
		cleanBaseUrl = cleanBaseUrl.slice(0, -4);
	}
	
	const options = {
		method: 'GET' as IHttpRequestMethods,
		url: `${cleanBaseUrl}/run/${executionId}/files`,
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
	let cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	if (cleanBaseUrl.endsWith('/run')) {
		cleanBaseUrl = cleanBaseUrl.slice(0, -4);
	}
	
	const options = {
		method: 'GET' as IHttpRequestMethods,
		url: `${cleanBaseUrl}/run/${executionId}/files/${fileName}`,
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
