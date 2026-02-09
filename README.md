# LaundryBot

LaundryBot is an intentionally simple Discord bot that helps my family of six communicate laundry
status. It tracks the current cycle, posts a live status card, and lets users complete help tasks
through buttons and select menus. The bot stores status and help requests in Oracle DB
tables and updates its presence with the current laundry state.

**Features**
- `/laundry` slash command that posts the interactive status card.
- "I Flipped It" and "Mark Laundry Completed" buttons to update status.
- "I Helped" flow with a select menu for resolving help tasks.
- Automatic notifications when a laundry cycle should be done.
- Presence updates reflecting the current availability and ETA.

**Core Flow**
1. Run `/laundry` to post the status card in the laundry channel.
2. Click "I Flipped It" to start a cycle and schedule a notification.
3. If help requests are active, use "I Helped" to resolve them.
4. The bot edits its presence and keeps the status card current.

**Project Structure**
- `src/laundryBot.ts` entrypoint and Discord client setup.
- `src/commands` slash command and component handlers.
- `src/services` UI, notifications, presence, and message helpers.
- `src/db` Oracle data access and business logic.
- `db` SQL scripts for schema setup and updates.
- `build` compiled output (do not edit directly).

**Prerequisites**
- Node.js `>=16` (see `package.json` engines).
- Oracle DB access (tables defined in `db`).
- Discord bot token and permissions to send and delete messages in the target channel.

**Environment Variables**
- `BOT_TOKEN` Discord bot token.
- `ORACLE_USER` Oracle DB username.
- `ORACLE_PASSWORD` Oracle DB password.
- `ORACLE_CONNECT_STRING` Oracle connection string.

**Database**
Table definitions live in the `db` directory. Apply the SQL files in order when setting up a fresh
database. New schema changes should be added as new dated SQL files.

**Run Locally**
```bash
npm install
npm run dev
```

**Build and Run**
```bash
npm run build
npm run start
```

**Useful Scripts**
- `npm run lint` run ESLint.
- `npm run compile` type-check only.
- `npm run watch` start a reload loop for local development.
- `npm run buildProd` compile and restart the PM2 process.

**Notes**
- The status card uses Discord components v2; the bot sends messages with
  `MessageFlags.IsComponentsV2`.
- The bot deletes the most recent LaundryBot status post before sending a new one so the channel
  stays clean.
