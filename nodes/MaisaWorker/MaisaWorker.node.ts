import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IDataObject,
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
		credentials: [
			{
				name: 'maisaWorkerApi',
				required: true,
			},
		],
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
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'The base URL of the Maisa Worker API',
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
		
		const credentials = await this.getCredentials('maisaWorkerApi');
		const apiKey = credentials.apiKey as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'runWorker' || operation === 'runWorkerAsync') {
					const result = await this.runWorker(i, baseUrl, apiKey);
					
					if (operation === 'runWorker') {
						// Wait for completion
						const pollingInterval = this.getNodeParameter('pollingInterval', i) as number;
						const timeout = this.getNodeParameter('timeout', i) as number;
						const autoDownloadFiles = this.getNodeParameter('autoDownloadFiles', i) as boolean;
						
						const executionId = result.data as string;
						const finalResult = await this.waitForCompletion(executionId, baseUrl, apiKey, pollingInterval, timeout);
						
						let outputFiles: IDataObject[] = [];
						if (autoDownloadFiles) {
							outputFiles = await this.downloadAllFiles(executionId, baseUrl, apiKey, i);
						}
						
						returnData.push({
							json: {
								...finalResult,
								executionId,
								outputFiles,
							},
							binary: outputFiles.length > 0 ? this.createBinaryData(outputFiles) : undefined,
						});
					} else {
						returnData.push({ json: result });
					}
					
				} else if (operation === 'getStatus') {
					const executionId = this.getNodeParameter('executionId', i) as string;
					const result = await this.getStatus(executionId, baseUrl, apiKey);
					returnData.push({ json: result });
					
				} else if (operation === 'listFiles') {
					const executionId = this.getNodeParameter('executionId', i) as string;
					const result = await this.listFiles(executionId, baseUrl, apiKey);
					returnData.push({ json: result });
					
				} else if (operation === 'downloadFile') {
					const executionId = this.getNodeParameter('executionId', i) as string;
					const fileName = this.getNodeParameter('fileName', i) as string;
					const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
					
					const fileData = await this.downloadFile(executionId, fileName, baseUrl, apiKey);
					
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
							error: error.message,
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

	private async runWorker(
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

		const options = {
			method: 'POST',
			url: `${baseUrl}/run`,
			headers: {
				'ms-api-key': apiKey,
				...formData.getHeaders(),
			},
			body: formData,
			json: false,
		};

		const response = await this.helpers.request(options);
		return JSON.parse(response);
	}

	private async getStatus(
		executionId: string,
		baseUrl: string,
		apiKey: string,
	): Promise<IDataObject> {
		const options = {
			method: 'GET',
			url: `${baseUrl}/run/${executionId}`,
			headers: {
				'ms-api-key': apiKey,
			},
			json: true,
		};

		return await this.helpers.request(options);
	}

	private async listFiles(
		executionId: string,
		baseUrl: string,
		apiKey: string,
	): Promise<IDataObject> {
		const options = {
			method: 'GET',
			url: `${baseUrl}/run/${executionId}/files`,
			headers: {
				'ms-api-key': apiKey,
			},
			json: true,
		};

		return await this.helpers.request(options);
	}

	private async downloadFile(
		executionId: string,
		fileName: string,
		baseUrl: string,
		apiKey: string,
	): Promise<IDataObject> {
		const options = {
			method: 'GET',
			url: `${baseUrl}/run/${executionId}/files/${fileName}`,
			headers: {
				'ms-api-key': apiKey,
			},
			encoding: null,
			json: false,
		};

		const response = await this.helpers.request(options);
		
		return {
			data: Buffer.from(response),
			fileName,
			mimeType: this.getMimeType(fileName),
		} as IDataObject;
	}

	private async waitForCompletion(
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

			const status = await this.getStatus(executionId, baseUrl, apiKey);
			const statusData = status.data as IDataObject;
			
			// Check if execution is complete (you may need to adjust this based on actual API response)
			if (statusData.result !== null && statusData.result !== undefined && statusData.result !== '') {
				return statusData;
			}

			// Wait before next poll
			await new Promise(resolve => setTimeout(resolve, intervalMs));
		}
	}

	private async downloadAllFiles(
		executionId: string,
		baseUrl: string,
		apiKey: string,
		itemIndex: number,
	): Promise<IDataObject[]> {
		const filesResponse = await this.listFiles(executionId, baseUrl, apiKey);
		const filesData = filesResponse.data as IDataObject;
		const outFiles = (filesData.out || []) as IDataObject[];
		
		const downloadedFiles: IDataObject[] = [];
		
		for (const file of outFiles) {
			const fileName = file.fileName as string;
			const fileData = await this.downloadFile(executionId, fileName, baseUrl, apiKey);
			downloadedFiles.push({
				fileName,
				...fileData,
			});
		}
		
		return downloadedFiles;
	}

	private createBinaryData(files: IDataObject[]): IDataObject {
		const binaryData: IDataObject = {};
		
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

	private getMimeType(fileName: string): string {
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
}
