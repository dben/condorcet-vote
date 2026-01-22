export interface Ballot {
  rankings: Map<number, number | null>; // option_id -> rank (lower is better, null = unranked)
}

export interface SchultzeResult {
  ranking: number[]; // option IDs in order (best to worst)
  pairwiseMatrix: number[][]; // d[i][j] = voters preferring i over j
  strengthMatrix: number[][]; // p[i][j] = strongest path from i to j
  optionIds: number[]; // mapping of matrix indices to option IDs
}

export function computeSchultze(
  optionIds: number[],
  ballots: Ballot[]
): SchultzeResult {
  const n = optionIds.length;
  const idToIndex = new Map<number, number>();
  optionIds.forEach((id, idx) => idToIndex.set(id, idx));

  // Step 1: Build pairwise preference matrix
  // d[i][j] = number of voters who prefer candidate i over candidate j
  const d: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const ballot of ballots) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;

        const optI = optionIds[i];
        const optJ = optionIds[j];
        const rankI = ballot.rankings.get(optI);
        const rankJ = ballot.rankings.get(optJ);

        // Determine preference
        // Lower rank = better preference
        // null/undefined = unranked (treated as worse than any ranked option)

        const iRanked = rankI !== null && rankI !== undefined;
        const jRanked = rankJ !== null && rankJ !== undefined;

        if (iRanked && jRanked) {
          // Both ranked: lower rank wins
          if (rankI < rankJ) {
            d[i][j]++;
          }
        } else if (iRanked && !jRanked) {
          // i is ranked, j is not: i wins
          d[i][j]++;
        }
        // If neither ranked or only j ranked, no preference for i over j
      }
    }
  }

  // Step 2: Compute strongest path strengths using Floyd-Warshall variant
  // p[i][j] = strength of strongest path from i to j
  const p: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  // Initialize with direct comparisons where i beats j
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        if (d[i][j] > d[j][i]) {
          p[i][j] = d[i][j];
        }
      }
    }
  }

  // Floyd-Warshall to find strongest paths
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      for (let j = 0; j < n; j++) {
        if (j === i || j === k) continue;
        // Strongest path through k
        const throughK = Math.min(p[i][k], p[k][j]);
        if (throughK > p[i][j]) {
          p[i][j] = throughK;
        }
      }
    }
  }

  // Step 3: Determine ranking
  // Count how many candidates each candidate beats
  const wins: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && p[i][j] > p[j][i]) {
        wins[i]++;
      }
    }
  }

  // Sort by number of wins (descending)
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => wins[b] - wins[a]);

  const ranking = indices.map(idx => optionIds[idx]);

  return {
    ranking,
    pairwiseMatrix: d,
    strengthMatrix: p,
    optionIds,
  };
}

export function formatResults(
  result: SchultzeResult,
  optionNames: Map<number, string>
): {
  rankedOptions: { id: number; name: string; position: number }[];
  matrix: { row: string; cells: { opponent: string; prefer: number; oppose: number }[] }[];
} {
  const rankedOptions = result.ranking.map((id, idx) => ({
    id,
    name: optionNames.get(id) || `Option ${id}`,
    position: idx + 1,
  }));

  const matrix = result.optionIds.map((rowId, i) => ({
    row: optionNames.get(rowId) || `Option ${rowId}`,
    cells: result.optionIds.map((colId, j) => ({
      opponent: optionNames.get(colId) || `Option ${colId}`,
      prefer: result.pairwiseMatrix[i][j],
      oppose: result.pairwiseMatrix[j][i],
    })),
  }));

  return { rankedOptions, matrix };
}
