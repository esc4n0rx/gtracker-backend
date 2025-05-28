// src/routes/search.js
const express = require('express');
const SearchController = require('../controllers/searchController');

const router = express.Router();

// GET /search/posts - Buscar posts
router.get('/posts', SearchController.searchPosts);

// GET /search/recent - Posts recentes
router.get('/recent', SearchController.getRecentPosts);

// GET /search/popular - Posts populares
router.get('/popular', SearchController.getPopularPosts);

module.exports = router;