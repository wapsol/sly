# Provider Authentication

Most hosted providers support one or both of these authentication methods:

- Sign in through a browser or device flow backed by OAuth.
- Provide an API key.

Use `/login [provider]` to see the methods supported by a provider. Amazon Bedrock and Google Vertex AI can also use ambient cloud credentials.

## Authenticate interactively

Run `/login` and select a provider. Sly guides you through its OAuth or API-key flow and saves the resulting credential in [`auth.json`](configuration.md#agent-directory).

On a remote or headless machine, an OAuth callback may not reach the local process. When prompted, paste the final redirect URL or authorization code back into Sly.

Run `/logout` and select a provider to remove its stored credential. This does not unset environment variables, remove authentication from `models.json`, or revoke the credential at the provider.

`auth.json` can contain API keys and OAuth tokens. Keep it private and do not commit it.

Radius authentication uses its gateway catalog and caches refreshed model metadata for later offline startup. A custom Radius gateway configured in `models.json` uses its own catalog rather than inheriting the public `radius.pi.dev` catalog.

## Use an API key from the environment

Environment variables are useful in CI and anywhere Sly should not store the key. Set the variable before starting Sly:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
sly
```

This table covers providers with a single primary API-key variable. Providers that need additional configuration or support ambient credentials are covered under [Cloud providers](#cloud-providers).

| Provider | Environment variable |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| Ant Ling | `ANT_LING_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI Coding Plan (Global) | `ZAI_API_KEY` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_API_KEY` |
| OpenCode Zen and Go | `OPENCODE_API_KEY` |
| Radius | `RADIUS_API_KEY` |
| TypeSafe ([classifier models](models.md#use-classifier-models)) | `TYPESAFE_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Meta | `META_API_KEY` |
| Melious | `MELIOUS_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` |
| Moonshot AI (Global and China) | `MOONSHOT_API_KEY` |
| Qwen Token Plan and Individual | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token Plan (China) | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo | `XIAOMI_API_KEY` |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |

Anthropic also recognizes `ANTHROPIC_OAUTH_TOKEN` as an API credential and `ANTHROPIC_AUTH_TOKEN` as bearer authentication.

## Load an API key from a command

To use a secret manager without writing the resolved key to disk, set a provider's `key` in `auth.json` to a command prefixed with `!`:

```json
{
  "anthropic": {
    "type": "api_key",
    "key": "!security find-generic-password -ws 'anthropic'"
  }
}
```

Sly runs the command when the key is first needed and caches its standard output for the process lifetime. Empty output, a timeout, or a nonzero exit leaves the key unresolved until Sly restarts.

## Melious

### Keeping curation across machines

`MELIOUS_MODELS` is read from the process environment when the catalog is **fetched**.
That makes it easy to lose: launch the binary a way that does not export it -- a fresh
install, a direct `node dist/bundle/cli.js`, a shell that already had `MELIOUS_API_KEY`
set -- and the next refresh persists everything the gateway advertises.

Two places survive that, both on disk:

- **`allowModels` in `models.json`** narrows a provider every time its models are
  composed, whatever refreshed the catalog:

  ```json
  {
    "providers": {
      "melious": { "allowModels": ["kimi-k2.7-code", "glm-5.3", "deepseek-v4-pro"] }
    }
  }
  ```

  A list that matches nothing is treated as stale rather than as "hide everything": the
  full catalog is kept, so a renamed id cannot leave an empty model picker.
  `sly --refresh-models` reports which allowed ids the catalog no longer has.
  Models defined explicitly under `models` are exempt from the filter.

- **`env` on the auth.json credential** (see [Auth File](#auth-file)) sets
  `MELIOUS_MODELS` for the process, which filters at fetch time so the narrowed catalog
  is what gets persisted.

Use `allowModels` when the question is "what should this agent offer"; use the auth-file
`env` when the question is "what should be stored at all".

### Refreshing on demand

```bash
sly --refresh-models     # force a network refresh, print per-provider counts, exit
sly update --models      # the same refresh, as a package subcommand
```

Both ignore `--offline`/`SLY_OFFLINE` and the 4-hour remote-catalog throttle.
Run one after editing `MELIOUS_MODELS` or `allowModels` to see the resulting catalog.

## Cloud Providers

The providers below need additional settings or can use credentials supplied by their cloud platform.

A stored API-key credential can include an `env` object. Its values take priority over the process environment for that provider:

```json
{
  "cloudflare-workers-ai": {
    "type": "api_key",
    "key": "...",
    "env": {
      "CLOUDFLARE_ACCOUNT_ID": "account-id"
    }
  }
}
```

### Azure OpenAI

Set an API key plus either a base URL or resource name:

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# Or:
export AZURE_OPENAI_RESOURCE_NAME=your-resource
```

Resource root URLs under `ai.azure.com`, `cognitiveservices.azure.com`, and `openai.azure.com` are normalized to the OpenAI API path.

### Amazon Bedrock

Bedrock can use a bearer token or an ambient AWS credential source:

```bash
# Named profile
export AWS_PROFILE=your-profile

# IAM keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
# Required for temporary credentials
export AWS_SESSION_TOKEN=...

# Bedrock bearer token
export AWS_BEARER_TOKEN_BEDROCK=...

# Region, when not supplied by the profile or AWS SDK configuration
export AWS_REGION=us-west-2
# AWS_DEFAULT_REGION is also supported
```

Sly also supports ECS task credentials and IRSA through the standard `AWS_CONTAINER_CREDENTIALS_*` and `AWS_WEB_IDENTITY_TOKEN_FILE` variables.

### Cloudflare AI Gateway

The gateway requires a token, account ID, and gateway ID:

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
```

The account and gateway IDs can come from the process environment or the credential's `env` object in `auth.json`.

`CLOUDFLARE_API_KEY` authenticates Sly to the gateway. Upstream access can use Cloudflare unified billing, credentials stored in the gateway, or an `Authorization` header configured for the provider in `models.json`.

### Cloudflare Workers AI

Workers AI requires a token and account ID:

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
```

The account ID can also be stored in the credential's `env` object.

### Google Vertex AI

Use a Google Cloud API key:

```bash
export GOOGLE_CLOUD_API_KEY=...
```

To use Application Default Credentials, configure a project and location:

```bash
export GOOGLE_CLOUD_PROJECT=your-project
# GCLOUD_PROJECT is also supported
export GOOGLE_CLOUD_LOCATION=us-central1
```

Then authenticate:

```bash
gcloud auth application-default login
```

To use a service-account key file instead, set `GOOGLE_APPLICATION_CREDENTIALS` along with the project and location.
