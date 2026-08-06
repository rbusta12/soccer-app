const express = require('express');
const espnService = require('../services/espnService');

const router = express.Router();

// GET /api/standings/:league
router.get('/:league', async (req, res, next) => {
  const { league } = req.params;

  if (!espnService.isSupportedLeague(league)) {
    return res.status(404).json({
      error: `Unsupported league '${league}'`,
      supportedLeagues: Object.keys(espnService.LEAGUES),
    });
  }

  try {
    const standings = await espnService.getStandings(league);
    return res.json({ league, standings });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
