# Brokoons Backend

Node.js backend for Brokoons team collaboration app.

## Setup
1. Clone repo
2. Install: `npm install`
3. Get Firebase service account key from Firebase Console
4. Save as `service-account-key.json` in project root
5. Run: `npm start`

## API Endpoints
- `GET /` - Home page
- `GET /health` - Health check
- `GET /api/test` - Test backend
- `GET /api/chats` - Get all chats
- `GET /api/tasks` - Get all tasks

## Development
```bash
npm start          # Start server
node server.js     # Alternative start