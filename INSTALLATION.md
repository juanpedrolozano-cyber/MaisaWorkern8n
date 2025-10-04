# Installation Guide - Maisa Worker N8N Node

## For Development and Testing

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- n8n installed locally or via Docker

### Option 1: Local Development Setup

1. **Clone and build the node:**

```bash
cd /Users/jp/Repositories/Tools/N8N
npm install
npm run build
```

2. **Link to your local n8n installation:**

```bash
# In this project directory
npm link

# In your n8n installation directory
cd ~/.n8n/custom
npm link n8n-nodes-maisa-worker
```

3. **Restart n8n:**

```bash
n8n start
```

### Option 2: Install in n8n Docker

1. **Build the node:**

```bash
npm install
npm run build
```

2. **Copy to n8n Docker container:**

```bash
# Create a volume mount or copy files
docker cp dist/. n8n_container:/home/node/.n8n/custom/
docker restart n8n_container
```

### Option 3: Install from npm (when published)

```bash
# In n8n UI: Settings > Community Nodes > Install
# Enter: n8n-nodes-maisa-worker
```

Or via command line:

```bash
npm install n8n-nodes-maisa-worker
```

## Configuration

### 1. Add Credentials

1. Open n8n
2. Go to **Credentials** > **New**
3. Search for "Maisa Worker API"
4. Enter your API Key
5. Save

### 2. Add Node to Workflow

1. Create a new workflow
2. Click **+** to add a node
3. Search for "Maisa Worker"
4. Configure the node with:
   - **Base URL**: Your Maisa Worker API endpoint
   - **Credentials**: Select the credentials you created
   - **Operation**: Choose the operation you want to perform

## Testing the Node

### Test 1: Simple Worker Execution

Create a workflow:

```
Manual Trigger → Maisa Worker (Run Worker)
```

**Maisa Worker Configuration:**
- Operation: Run Worker
- Base URL: `https://your-api.com/v1`
- Input Variables:
  - name: "test"
  - value: "Hello World"
- Polling Interval: 5
- Timeout: 60
- Auto Download Files: true

Execute and check the output.

### Test 2: File Upload

Create a workflow:

```
Manual Trigger → HTTP Request (download file) → Maisa Worker (Run Worker)
```

**HTTP Request:**
- Method: GET
- URL: Any file URL
- Response Format: File

**Maisa Worker:**
- Operation: Run Worker
- Files: `data` (from HTTP Request)
- Input Variables as needed

### Test 3: Async Execution

Create a workflow:

```
Manual Trigger → Maisa Worker (Run Async) → Wait → Maisa Worker (Get Status)
```

## Troubleshooting

### Node doesn't appear in n8n

1. Check that the build was successful: `ls dist/`
2. Verify n8n can see the node: Check n8n logs
3. Restart n8n completely
4. Clear browser cache

### TypeScript errors during build

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Credentials not working

1. Verify API key is correct
2. Check that the base URL doesn't have trailing slashes
3. Test the API directly with curl:

```bash
curl -H "ms-api-key: YOUR_KEY" https://your-api.com/v1/health
```

### Files not downloading

1. Ensure "Auto Download Files" is enabled
2. Check that the worker actually produces output files
3. Verify the execution completed successfully
4. Check n8n logs for errors

## Development Workflow

### Making Changes

1. Edit the TypeScript files in `nodes/` or `credentials/`
2. Rebuild: `npm run build`
3. Restart n8n
4. Test your changes

### Watch Mode

For faster development:

```bash
npm run dev
```

This will watch for file changes and rebuild automatically.

### Linting

```bash
npm run lint
npm run lintfix
```

### Format Code

```bash
npm run format
```

## Publishing to npm

When ready to publish:

1. Update version in `package.json`
2. Build: `npm run build`
3. Test thoroughly
4. Publish: `npm publish`

## Environment-Specific Notes

### macOS

```bash
# If you get permission errors
sudo chown -R $(whoami) ~/.n8n
```

### Linux

```bash
# May need to use sudo for global npm install
sudo npm install -g n8n
```

### Windows

Use PowerShell or Git Bash for commands.

## Support

- GitHub Issues: https://github.com/juanpedrolozano-cyber/MaisaWorkern8n/issues
- Documentation: See README.md and EXAMPLES.md
