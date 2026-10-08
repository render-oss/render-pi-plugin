# Render CLI Command Cheatsheet

For authentication, workspace selection, exact command discovery, and non-interactive output guidance, first read [render-access.md](render-access.md).

## Services

```bash
# List all services
render services
render services -o json --confirm

# Filter by type (via jq)
render services -o json --confirm | jq '.[] | select(.type == "web_service")'
```

## Deploys

```bash
# Trigger deploy (interactive)
render deploys create

# Trigger deploy (non-interactive)
render deploys create srv-xxx --confirm -o json

# Deploy and wait for completion
render deploys create srv-xxx --wait --confirm -o json

# Deploy specific commit
render deploys create srv-xxx --commit abc123 --wait --confirm

# Deploy specific Docker image
render deploys create srv-xxx --image ghcr.io/org/app:v1.2.3 --wait --confirm

# List deploys
render deploys list srv-xxx -o json --confirm
```

## Logs

```bash
# View recent logs
render logs -r srv-xxx

# Stream logs (follow mode)
render logs -r srv-xxx --tail

# Logs in JSON format
render logs -r srv-xxx -o json
```

## SSH

```bash
# SSH into running instance
render ssh srv-xxx

# Ephemeral shell (isolated, no running service process)
render ssh srv-xxx --ephemeral
render ssh srv-xxx -e
```

## Database (psql)

```bash
# Interactive psql session
render psql db-xxx

# Single query
render psql db-xxx -c "SELECT NOW();"

# JSON output
render psql db-xxx -c "SELECT id, name FROM users LIMIT 5;" -o json

# CSV output (via psql passthrough)
render psql db-xxx -c "SELECT id, email FROM users;" -o text -- --csv

# Quiet output (no headers, unaligned)
render psql db-xxx -c "SELECT count(*) FROM users;" -o text -- -t -A
```

## Blueprints

```bash
# Validate render.yaml in current directory
render blueprints validate

# Validate specific file
render blueprints validate path/to/render.yaml
```

## Skills

```bash
# Interactive skill management
render skills

# Install skills
render skills install

# Update skills
render skills update

# List installed skills
render skills list
```

## Non-Interactive Patterns

Always include `--confirm` and `-o <format>` for CI/CD:

```bash
# Deploy and check exit code
render deploys create srv-xxx --wait --confirm -o json
if [ $? -ne 0 ]; then
  echo "Deploy failed"
  exit 1
fi

# Get service URL
render services -o json --confirm | jq -r '.[] | select(.id == "srv-xxx") | .serviceDetails.url'
```

## Config

```bash
# Config file location
cat ~/.render/cli.yaml

# Override config path
export RENDER_CLI_CONFIG_PATH=/path/to/cli.yaml
```
