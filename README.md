# Simple Discord Points Bot

Originally created for the [Domaincord Community](https://discord.gg/R6wTYQ9).

## Usage
I'm assuming you already know how to get a bot token and add the bot to your server.

1. Rename the `.env.example` file to `.env` and fill in the appropriate values.
2. Download a Firebase Admin service account key and put it in the root directory of the bot folder and make sure to call it `serviceAccountKey.json`
2. Run `npm install`
3. Run `npm start` or use a process manager like [pm2](https://pm2.keymetrics.io/) to keep the bot running across server restarts and automatically restart the bot if it crashes.

**Make sure the bot has access to read and send messages in all channels you want the commands to be used!**
