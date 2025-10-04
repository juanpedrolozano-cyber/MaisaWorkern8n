# Maisa Worker Node - Usage Examples

This document provides detailed examples of how to use the Maisa Worker node in different scenarios.

## Example 1: Simple Text Processing

This example shows how to run a worker with simple text input.

### Workflow:
```
[Manual Trigger] → [Maisa Worker]
```

### Configuration:
**Maisa Worker Node:**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1`
- Input Variables:
  ```
  name: "prompt"
  value: "Generate a creative story about AI"
  ```
- Polling Interval: `5` seconds
- Timeout: `300` seconds
- Auto Download Files: `true`

### Expected Output:
The node will return the execution result with any generated files automatically downloaded as binary data.

---

## Example 2: Excel File Processing

Process an Excel file and get results back.

### Workflow:
```
[Manual Trigger] → [Read Binary File] → [Maisa Worker] → [Write Binary File]
```

### Configuration:

**Read Binary File Node:**
- File Path: `/path/to/input.xlsx`
- Property Name: `data`

**Maisa Worker Node:**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1`
- Input Variables:
  ```
  name: "excel_file"
  value: ""
  ```
- Files: `data`
- Polling Interval: `10` seconds
- Timeout: `600` seconds
- Auto Download Files: `true`

**Write Binary File Node:**
- File Path: `/path/to/output.pdf`
- Property Name: `data` (or `data0`, `data1` if multiple files)

---

## Example 3: Async Execution with Manual Polling

Start a long-running worker and check status manually.

### Workflow:
```
[Manual Trigger] → [Maisa Worker: Run Async] → [Wait] → [Maisa Worker: Get Status] → [IF] → [Maisa Worker: Download File]
```

### Configuration:

**Maisa Worker Node 1 (Run Async):**
- Operation: `Run Worker (Async)`
- Base URL: `https://api.maisaworker.com/v1`
- Input Variables:
  ```
  name: "task"
  value: "Long running analysis"
  ```

**Wait Node:**
- Wait: `30` seconds

**Maisa Worker Node 2 (Get Status):**
- Operation: `Get Status`
- Base URL: `https://api.maisaworker.com/v1`
- Execution ID: `{{$json["data"]}}`

**IF Node:**
- Condition: `{{$json["data"]["result"]}}` is not empty

**Maisa Worker Node 3 (List Files):**
- Operation: `List Files`
- Base URL: `https://api.maisaworker.com/v1`
- Execution ID: `{{$json["data"]["id"]}}`

**Maisa Worker Node 4 (Download File):**
- Operation: `Download File`
- Base URL: `https://api.maisaworker.com/v1`
- Execution ID: `{{$json["data"]["id"]}}`
- File Name: `{{$json["data"]["out"][0]["fileName"]}}`
- Binary Property: `data`

---

## Example 4: Batch Processing Multiple Files

Process multiple files in a loop.

### Workflow:
```
[Schedule Trigger] → [Read Files from Folder] → [Split In Batches] → [Maisa Worker] → [Write Binary File]
```

### Configuration:

**Schedule Trigger:**
- Trigger Interval: Every hour

**Read Files from Folder Node:**
- Folder Path: `/path/to/input/folder`
- File Extension: `.xlsx`

**Split In Batches Node:**
- Batch Size: `1`

**Maisa Worker Node:**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1`
- Input Variables:
  ```
  name: "file_name"
  value: "{{$json["fileName"]}}"
  ```
- Files: `data`
- Polling Interval: `10` seconds
- Timeout: `600` seconds
- Auto Download Files: `true`

**Write Binary File Node:**
- File Path: `/path/to/output/{{$json["fileName"]}}`
- Property Name: `data`

---

## Example 5: Webhook Triggered Processing

Receive files via webhook and process them.

### Workflow:
```
[Webhook] → [Maisa Worker] → [Webhook Response]
```

### Configuration:

**Webhook Node:**
- HTTP Method: `POST`
- Path: `/process-file`
- Response Mode: `Last Node`

**Maisa Worker Node:**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1`
- Input Variables:
  ```
  name: "user_id"
  value: "{{$json["body"]["userId"]}}"
  
  name: "operation"
  value: "{{$json["body"]["operation"]}}"
  ```
- Files: `data`
- Polling Interval: `5` seconds
- Timeout: `300` seconds
- Auto Download Files: `true`

**Webhook Response Node:**
- Response Code: `200`
- Response Body:
  ```json
  {
    "status": "success",
    "executionId": "{{$json["executionId"]}}",
    "result": "{{$json["result"]}}",
    "files": "{{$json["outputFiles"]}}"
  }
  ```

---

## Example 6: Error Handling

Handle errors gracefully with retry logic.

### Workflow:
```
[Manual Trigger] → [Maisa Worker] → [IF: Error] → [Wait] → [Maisa Worker: Retry]
```

### Configuration:

**Maisa Worker Node:**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1`
- Input Variables: [...]
- Continue On Fail: `true`

**IF Node:**
- Condition: `{{$json["error"]}}` exists

**Wait Node (on error branch):**
- Wait: `60` seconds

**Maisa Worker Node (Retry):**
- Same configuration as first node

---

## Example 7: Multi-Step Processing Pipeline

Chain multiple worker operations.

### Workflow:
```
[Manual Trigger] → [Maisa Worker 1: Extract] → [Maisa Worker 2: Transform] → [Maisa Worker 3: Generate Report]
```

### Configuration:

**Maisa Worker 1 (Extract):**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1/extract`
- Input Variables:
  ```
  name: "source"
  value: "database"
  ```
- Auto Download Files: `true`

**Maisa Worker 2 (Transform):**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1/transform`
- Files: `data` (from previous node)
- Input Variables:
  ```
  name: "transformation"
  value: "normalize"
  ```
- Auto Download Files: `true`

**Maisa Worker 3 (Generate Report):**
- Operation: `Run Worker`
- Base URL: `https://api.maisaworker.com/v1/report`
- Files: `data` (from previous node)
- Input Variables:
  ```
  name: "format"
  value: "pdf"
  ```
- Auto Download Files: `true`

---

## Tips and Best Practices

### 1. Polling Interval
- For quick tasks (< 30 seconds): Use 3-5 second intervals
- For medium tasks (30-120 seconds): Use 10-15 second intervals
- For long tasks (> 2 minutes): Use 30-60 second intervals

### 2. Timeout Settings
- Set timeout to at least 2x the expected execution time
- For unpredictable tasks, use a generous timeout (600+ seconds)

### 3. File Handling
- Always specify the correct binary property name
- Use descriptive property names when downloading multiple files
- Check file sizes before processing to avoid memory issues

### 4. Error Handling
- Always enable "Continue On Fail" for production workflows
- Implement retry logic for transient failures
- Log errors to a database or monitoring service

### 5. Performance
- Use async execution for non-critical tasks
- Batch process files when possible
- Consider using webhooks for long-running operations

### 6. Security
- Store API keys in n8n credentials, never hardcode them
- Use environment variables for base URLs
- Validate input data before sending to workers

---

## Common Issues and Solutions

### Issue: "Worker execution timed out"
**Solution:** Increase the timeout parameter or check if the worker is actually running.

### Issue: "Files not found"
**Solution:** Ensure the worker has completed and files were generated. Check with List Files operation first.

### Issue: "API key invalid"
**Solution:** Verify credentials are correctly configured and the API key has necessary permissions.

### Issue: "Binary data not accessible"
**Solution:** Check that the binary property name matches between nodes and that Auto Download Files is enabled.

### Issue: "Rate limit exceeded"
**Solution:** Increase polling interval or implement exponential backoff.
