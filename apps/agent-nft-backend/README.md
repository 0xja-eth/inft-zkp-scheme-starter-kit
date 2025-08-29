# Agent NFT Backend API

A comprehensive REST API backend for managing Agent NFTs on the 0G Protocol. This backend provides a simple HTTP interface for minting, transferring, cloning, and managing intelligent NFTs with encrypted metadata.

## 🚀 Features

- **Complete Agent NFT Operations**: Mint, transfer, clone, update, and query Agent NFTs
- **OpenAPI Documentation**: Auto-generated Swagger documentation
- **Data Validation**: Comprehensive request validation using Joi
- **Error Handling**: Structured error responses and logging
- **Rate Limiting**: Built-in API rate limiting for protection
- **Security**: CORS, Helmet, and other security middleware
- **Blockchain Integration**: Full integration with 0G Protocol and Ethereum
- **Storage Support**: Both local and 0G Storage support
- **TypeScript**: Full TypeScript support with type safety

## 📋 Prerequisites

- Node.js 18+ and pnpm
- Access to 0G testnet
- Deployed AgentNFT and Verifier contracts
- Private key with test tokens

## 🛠️ Installation

```bash
# Navigate to the backend directory
cd apps/agent-nft-backend

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Edit environment variables
vim .env
```

## ⚙️ Configuration

Update the `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Ethereum Network Configuration
RPC_URL=https://evmrpc-testnet.0g.ai
CHAIN_ID=16600
NETWORK_NAME=0g-testnet

# Contract Addresses (Update with your deployed contracts)
AGENT_NFT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
VERIFIER_ADDRESS=0xabcdef1234567890abcdef1234567890abcdef12

# Private Key (for backend operations - be careful!)
PRIVATE_KEY=your_private_key_here

# Storage Configuration
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./temp/local-storage

# API Configuration
API_RATE_LIMIT_WINDOW=15
API_RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3001
```

## 🏃‍♂️ Running the Server

```bash
# Development mode with hot reload
pnpm dev

# Alternative start method
pnpm start:server

# Build for production
pnpm build

# Start production server
pnpm start
```

The server will start on `http://localhost:3000` and display:
- API documentation at `http://localhost:3000/api/docs`
- Health check at `http://localhost:3000/api/v1/health`

## 📚 API Documentation

### Health Endpoints

- `GET /api/v1/health` - Check API health status
- `GET /api/v1/health/info` - Get detailed system information

### Agent NFT Endpoints

- `POST /api/v1/agent/mint` - Mint a new Agent NFT
- `POST /api/v1/agent/transfer` - Transfer an Agent NFT
- `POST /api/v1/agent/clone` - Clone an Agent NFT
- `POST /api/v1/agent/update` - Update Agent NFT metadata
- `GET /api/v1/agent/{tokenId}` - Get Agent NFT information
- `GET /api/v1/agent/tokens/existing` - Get all existing tokens
- `GET /api/v1/agent/tokens/owned` - Get tokens owned by address
- `POST /api/v1/agent/authorize` - Authorize usage for a user

### Example Requests

#### Mint an Agent NFT

```bash
curl -X POST http://localhost:3000/api/v1/agent/mint \\
  -H "Content-Type: application/json" \\
  -d '{
    "metadata": {
      "name": "Aurora Assistant",
      "description": "AI assistant for Web3 interactions",
      "model": "gpt-4",
      "version": "1.0.0",
      "personality": "Helpful and friendly",
      "capabilities": [
        {
          "name": "TextGeneration",
          "description": "Generate natural text responses"
        }
      ],
      "attributes": {
        "responseTimeMs": 150,
        "maxTokenLimit": 2048
      }
    }
  }'
```

#### Get Token Information

```bash
curl http://localhost:3000/api/v1/agent/1
```

#### Transfer an Agent NFT

```bash
curl -X POST http://localhost:3000/api/v1/agent/transfer \\
  -H "Content-Type: application/json" \\
  -d '{
    "tokenId": 1,
    "recipientAddress": "0x742d35Cc6634C0532925a3b8D404fF10c7B8B0b",
    "recipientEncPublicKey": "BO6ehe7KGZ4hxqJEUTHos8EvJ5zvRIS0mFF/85Lf4kA=",
    "signature": "0x55a6098b223d4323e62a10151a0cf56986c87a9ad6cb040f8232308f1fcefd49..."
  }'
```

## 🏗️ Project Structure

```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware (validation, errors)
├── routes/          # API route handlers
│   ├── agent.ts     # Agent NFT operations
│   ├── health.ts    # Health check endpoints
│   └── index.ts     # Route aggregation
├── services/        # Business logic
│   └── AgentNFTService.ts
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   └── logger.ts    # Winston logger configuration
├── server.ts        # Express server setup
└── swagger.ts       # OpenAPI documentation
```

## 🔧 Development

### Adding New Endpoints

1. Define types in `src/types/index.ts`
2. Add validation schemas in `src/middleware/validation.ts`
3. Create route handlers in appropriate route files
4. Add Swagger documentation comments
5. Test using the `/api/docs` interface

### Testing

The API includes comprehensive validation and error handling. Test endpoints using:

- Swagger UI at `/api/docs`
- Postman or similar HTTP clients
- curl commands as shown above

### Logging

The backend uses Winston for structured logging:
- Console logs in development
- File logs in `logs/` directory
- Configurable log levels via `LOG_LEVEL` environment variable

## 🚦 Error Handling

All API responses follow a consistent structure:

```json
{
  "success": boolean,
  "data": any,
  "error": string,
  "message": string
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Validation Error
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🔐 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable allowed origins
- **Helmet Security**: Security headers and CSP
- **Input Validation**: Joi schema validation
- **Error Sanitization**: No sensitive data in error responses

## 🌐 Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a process manager like PM2
3. Configure reverse proxy (nginx)
4. Set up SSL/TLS certificates
5. Monitor logs and performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.