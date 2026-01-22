# Condorcet Voting App - Requirements

## Overview
A TypeScript Node.js application for creating and managing Condorcet voting polls using the Schulze method.

## Technical Stack
- **Runtime**: Node.js with TypeScript
- **Database**: SQLite (stored in `/config` folder for Docker mounting)
- **Web Framework**: Express.js
- **Templating**: EJS
- **Containerization**: Docker

## Features

### Poll Creation (Home Page)
- [x] Form to create a new poll with:
  - Poll title/description
  - Initial voting options
  - Toggle to allow other users to add options
- [x] Generates a unique URL for sharing

### Voting Page (Unique Poll URL)
- [x] User enters their name
- [x] User ranks options in order of preference (drag-and-drop or number input)
- [x] Options can be left unranked (treated as tied for last)
- [x] If enabled, users can add new options
- [x] New options don't affect existing votes (unranked = no preference)
- [x] Submit vote and view current results
- [x] localStorage saves voter identity to prevent re-prompting

### Results Display
- [x] Shows current Schulze method results
- [x] Displays pairwise comparison matrix
- [x] Shows winner and full ranking

### Vote Editing
- [x] Returning users (via localStorage) see results directly
- [x] Option to edit their previous vote

## Schulze Method Implementation
The Schultze method is a Condorcet voting system that:
1. Creates pairwise comparisons between all candidates
2. Finds the strongest path between each pair of candidates
3. Candidate A beats B if the strongest path from A to B is stronger than B to A
4. Results in a complete ranking of all candidates

## Database Schema

### polls
- `id` (TEXT, PRIMARY KEY) - unique poll identifier
- `title` (TEXT) - poll title/description
- `allow_new_options` (INTEGER) - boolean flag
- `created_at` (DATETIME)

### options
- `id` (INTEGER, PRIMARY KEY)
- `poll_id` (TEXT, FOREIGN KEY)
- `text` (TEXT) - option text
- `created_at` (DATETIME)

### votes
- `id` (INTEGER, PRIMARY KEY)
- `poll_id` (TEXT, FOREIGN KEY)
- `voter_name` (TEXT)
- `voter_token` (TEXT) - for localStorage matching
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### vote_rankings
- `id` (INTEGER, PRIMARY KEY)
- `vote_id` (INTEGER, FOREIGN KEY)
- `option_id` (INTEGER, FOREIGN KEY)
- `rank` (INTEGER) - lower = better, NULL = unranked

## API Endpoints

### `GET /`
Home page with poll creation form

### `POST /api/polls`
Create a new poll

### `GET /poll/:id`
View poll page (vote or results based on localStorage)

### `POST /api/polls/:id/vote`
Submit or update a vote

### `GET /api/polls/:id/results`
Get current poll results

### `POST /api/polls/:id/options`
Add a new option to a poll (if allowed)

## Docker Configuration
- Dockerfile for building the application
- Database stored in `/config/vote.db`
- Config folder mountable as volume
- Exposes port 3000
