import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const configDir = path.join(process.cwd(), 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const dbPath = path.join(configDir, 'vote.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    allow_new_options INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id TEXT NOT NULL,
    voter_name TEXT NOT NULL,
    voter_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    UNIQUE(poll_id, voter_token)
  );

  CREATE TABLE IF NOT EXISTS vote_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vote_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    rank INTEGER,
    FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE CASCADE,
    UNIQUE(vote_id, option_id)
  );

  CREATE INDEX IF NOT EXISTS idx_options_poll ON options(poll_id);
  CREATE INDEX IF NOT EXISTS idx_votes_poll ON votes(poll_id);
  CREATE INDEX IF NOT EXISTS idx_votes_token ON votes(voter_token);
  CREATE INDEX IF NOT EXISTS idx_rankings_vote ON vote_rankings(vote_id);
`);

export interface Poll {
  id: string;
  title: string;
  allow_new_options: number;
  created_at: string;
}

export interface Option {
  id: number;
  poll_id: string;
  text: string;
  created_at: string;
}

export interface Vote {
  id: number;
  poll_id: string;
  voter_name: string;
  voter_token: string;
  created_at: string;
  updated_at: string;
}

export interface VoteRanking {
  id: number;
  vote_id: number;
  option_id: number;
  rank: number | null;
}

export const pollQueries = {
  create: db.prepare<[string, string, number]>(
    'INSERT INTO polls (id, title, allow_new_options) VALUES (?, ?, ?)'
  ),
  getById: db.prepare<[string]>('SELECT * FROM polls WHERE id = ?'),
  getAll: db.prepare('SELECT * FROM polls ORDER BY created_at DESC'),
};

export const optionQueries = {
  create: db.prepare<[string, string]>(
    'INSERT INTO options (poll_id, text) VALUES (?, ?)'
  ),
  getByPollId: db.prepare<[string]>(
    'SELECT * FROM options WHERE poll_id = ? ORDER BY id'
  ),
  getById: db.prepare<[number]>('SELECT * FROM options WHERE id = ?'),
};

export const voteQueries = {
  create: db.prepare<[string, string, string]>(
    'INSERT INTO votes (poll_id, voter_name, voter_token) VALUES (?, ?, ?)'
  ),
  update: db.prepare<[string, number]>(
    'UPDATE votes SET voter_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  getByPollAndToken: db.prepare<[string, string]>(
    'SELECT * FROM votes WHERE poll_id = ? AND voter_token = ?'
  ),
  getByPollId: db.prepare<[string]>(
    'SELECT * FROM votes WHERE poll_id = ? ORDER BY created_at'
  ),
  getById: db.prepare<[number]>('SELECT * FROM votes WHERE id = ?'),
};

export const rankingQueries = {
  upsert: db.prepare<[number, number, number | null]>(`
    INSERT INTO vote_rankings (vote_id, option_id, rank) VALUES (?, ?, ?)
    ON CONFLICT(vote_id, option_id) DO UPDATE SET rank = excluded.rank
  `),
  deleteByVoteId: db.prepare<[number]>(
    'DELETE FROM vote_rankings WHERE vote_id = ?'
  ),
  getByVoteId: db.prepare<[number]>(
    'SELECT * FROM vote_rankings WHERE vote_id = ?'
  ),
  getByPollId: db.prepare<[string]>(`
    SELECT vr.* FROM vote_rankings vr
    JOIN votes v ON vr.vote_id = v.id
    WHERE v.poll_id = ?
  `),
};

export default db;
