import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import db, {
  pollQueries,
  optionQueries,
  voteQueries,
  rankingQueries,
  Poll,
  Option,
  Vote,
  VoteRanking,
} from '../lib/database';
import { computeSchultze, formatResults, Ballot } from '../lib/schultze';

const router = Router();

// Create a new poll
router.post('/polls', (req: Request, res: Response) => {
  try {
    const { title, options, allowNewOptions } = req.body;

    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      res.status(400).json({ error: 'Title and at least 2 options required' });
      return;
    }

    const pollId = nanoid(10);
    const allowNew = allowNewOptions ? 1 : 0;

    const transaction = db.transaction(() => {
      pollQueries.create.run(pollId, title, allowNew);
      for (const optionText of options) {
        if (optionText.trim()) {
          optionQueries.create.run(pollId, optionText.trim());
        }
      }
    });

    transaction();

    res.json({ id: pollId, url: `/poll/${pollId}` });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Get poll data
router.get('/polls/:id', (req: Request, res: Response) => {
  try {
    const poll = pollQueries.getById.get(req.params.id) as Poll | undefined;
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const options = optionQueries.getByPollId.all(req.params.id) as Option[];
    const votes = voteQueries.getByPollId.all(req.params.id) as Vote[];

    res.json({
      poll,
      options,
      voteCount: votes.length,
    });
  } catch (error) {
    console.error('Error getting poll:', error);
    res.status(500).json({ error: 'Failed to get poll' });
  }
});

// Get existing vote for a voter
router.get('/polls/:id/vote/:token', (req: Request, res: Response) => {
  try {
    const vote = voteQueries.getByPollAndToken.get(
      req.params.id,
      req.params.token
    ) as Vote | undefined;

    if (!vote) {
      res.json({ exists: false });
      return;
    }

    const rankings = rankingQueries.getByVoteId.all(vote.id) as VoteRanking[];
    const rankingMap: Record<number, number | null> = {};
    for (const r of rankings) {
      rankingMap[r.option_id] = r.rank;
    }

    res.json({
      exists: true,
      vote: {
        id: vote.id,
        voterName: vote.voter_name,
        rankings: rankingMap,
      },
    });
  } catch (error) {
    console.error('Error getting vote:', error);
    res.status(500).json({ error: 'Failed to get vote' });
  }
});

// Submit or update a vote
router.post('/polls/:id/vote', (req: Request, res: Response) => {
  try {
    const { voterName, voterToken, rankings } = req.body;
    const pollId = req.params.id;

    if (!voterName || !voterToken) {
      res.status(400).json({ error: 'Voter name and token required' });
      return;
    }

    const poll = pollQueries.getById.get(pollId) as Poll | undefined;
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const options = optionQueries.getByPollId.all(pollId) as Option[];
    const optionIds = new Set(options.map(o => o.id));

    const transaction = db.transaction(() => {
      let existingVote = voteQueries.getByPollAndToken.get(
        pollId,
        voterToken
      ) as Vote | undefined;

      let voteId: number;

      if (existingVote) {
        // Update existing vote
        voteQueries.update.run(voterName, existingVote.id);
        rankingQueries.deleteByVoteId.run(existingVote.id);
        voteId = existingVote.id;
      } else {
        // Create new vote
        const result = voteQueries.create.run(pollId, voterName, voterToken);
        voteId = result.lastInsertRowid as number;
      }

      // Insert rankings
      if (rankings && typeof rankings === 'object') {
        for (const [optionIdStr, rank] of Object.entries(rankings)) {
          const optionId = parseInt(optionIdStr, 10);
          if (optionIds.has(optionId)) {
            const rankValue = rank === null || rank === undefined ? null : Number(rank);
            rankingQueries.upsert.run(voteId, optionId, rankValue);
          }
        }
      }

      return voteId;
    });

    const voteId = transaction();
    res.json({ success: true, voteId });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Add a new option to a poll
router.post('/polls/:id/options', (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const pollId = req.params.id;

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Option text required' });
      return;
    }

    const poll = pollQueries.getById.get(pollId) as Poll | undefined;
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    if (!poll.allow_new_options) {
      res.status(403).json({ error: 'Adding new options is not allowed for this poll' });
      return;
    }

    const result = optionQueries.create.run(pollId, text.trim());
    const newOption = optionQueries.getById.get(result.lastInsertRowid as number) as Option;

    res.json({ option: newOption });
  } catch (error) {
    console.error('Error adding option:', error);
    res.status(500).json({ error: 'Failed to add option' });
  }
});

// Get poll results
router.get('/polls/:id/results', (req: Request, res: Response) => {
  try {
    const pollId = req.params.id;

    const poll = pollQueries.getById.get(pollId) as Poll | undefined;
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const options = optionQueries.getByPollId.all(pollId) as Option[];
    const votes = voteQueries.getByPollId.all(pollId) as Vote[];

    if (votes.length === 0) {
      res.json({
        poll,
        options,
        voteCount: 0,
        results: null,
        message: 'No votes yet',
      });
      return;
    }

    // Build ballots
    const ballots: Ballot[] = [];
    const optionIds = options.map(o => o.id);
    const optionNames = new Map(options.map(o => [o.id, o.text]));

    for (const vote of votes) {
      const rankings = rankingQueries.getByVoteId.all(vote.id) as VoteRanking[];
      const ballot: Ballot = {
        rankings: new Map(),
      };
      for (const r of rankings) {
        ballot.rankings.set(r.option_id, r.rank);
      }
      ballots.push(ballot);
    }

    // Compute Schulze results
    const schulzeResult = computeSchultze(optionIds, ballots);
    const formattedResults = formatResults(schulzeResult, optionNames);

    res.json({
      poll,
      options,
      voteCount: votes.length,
      results: formattedResults,
      voters: votes.map(v => v.voter_name),
    });
  } catch (error) {
    console.error('Error getting results:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

export default router;
