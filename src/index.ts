import express from 'express';
import path from 'path';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// API routes
app.use('/api', apiRoutes);

// Page routes
app.get('/', (_req, res) => {
  res.render('index');
});

app.get('/poll/:id', (req, res) => {
  res.render('poll', { pollId: req.params.id });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
