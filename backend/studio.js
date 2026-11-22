/**
 * Anytime-Help: Lightweight Prisma-Style Studio
 * Native Mongoose DocumentDB Web Studio mounted on /orm-db
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Import all models
const models = {
  User: require('./models/User'),
  Complaint: require('./models/Complaint'),
  Category: require('./models/Category'),
  Banner: require('./models/Banner'),
  StaffBanner: require('./models/StaffBanner'),
  BottomBanner: require('./models/BottomBanner'),
  Announcement: require('./models/Announcement'),
  Story: require('./models/Story'),
  Area: require('./models/Area'),
  Community: require('./models/Community'),
  CommunitySection: require('./models/CommunitySection'),
  Official: require('./models/Official'),
  OfficialPost: require('./models/OfficialPost'),
  Department: require('./models/Department'),
  Directory: require('./models/Directory')
};

const app = express();
const PORT = process.env.STUDIO_PORT || 8080;
const BASE_PATH = '/orm-db';

app.use(express.json());

// Redirect root to /orm-db
app.get('/', (req, res) => {
  res.redirect(BASE_PATH);
});

// API: Get list of all models and their counts
app.get(`${BASE_PATH}/api/models`, async (req, res) => {
  try {
    const list = [];
    for (const [name, model] of Object.entries(models)) {
      const count = await model.countDocuments();
      list.push({ name, count });
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get paginated data for a selected model
app.get(`${BASE_PATH}/api/data/:model`, async (req, res) => {
  try {
    const model = models[req.params.model];
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = { $text: { $search: search } };
    }

    const total = await model.countDocuments();
    const docs = await model.find().sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).lean();

    res.json({ total, page, limit, docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Web UI: Prisma Studio Style Frontend on /orm-db
app.get(BASE_PATH, (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Anytime-Help Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 flex h-screen overflow-hidden">

  <!-- Sidebar -->
  <aside class="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
    <div class="p-4 border-b border-slate-800 flex items-center gap-2">
      <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
      <h1 class="font-bold text-lg text-emerald-400">Anytime Studio</h1>
    </div>
    <div class="px-3 py-2 text-xs font-semibold uppercase text-slate-500 tracking-wider">Models</div>
    <div id="modelList" class="flex-1 overflow-y-auto px-2 space-y-1 custom-scroll">
      <div class="text-xs text-slate-500 p-2">Loading models...</div>
    </div>
    <div class="p-3 border-t border-slate-800 text-xs text-slate-500">
      Connected to Amazon DocumentDB
    </div>
  </aside>

  <!-- Main Content Area -->
  <main class="flex-1 flex flex-col bg-slate-900 overflow-hidden">
    <!-- Top Bar -->
    <header class="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50">
      <div class="flex items-center gap-3">
        <h2 id="currentModel" class="font-semibold text-lg text-white">Select a Model</h2>
        <span id="recordCount" class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">0 records</span>
      </div>
      <div class="flex items-center gap-3">
        <button id="prevBtn" class="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-40">Previous</button>
        <span id="pageIndicator" class="text-xs text-slate-400">Page 1</span>
        <button id="nextBtn" class="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-40">Next</button>
      </div>
    </header>

    <!-- Table Container -->
    <div class="flex-1 overflow-auto custom-scroll p-4" id="tableContainer">
      <div class="h-full flex items-center justify-center text-slate-500 text-sm">
        Select a collection from the sidebar to view documents
      </div>
    </div>
  </main>

  <!-- JSON Modal -->
  <div id="modal" class="fixed inset-0 bg-black/70 hidden items-center justify-center p-6 z-50">
    <div class="bg-slate-950 border border-slate-800 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
      <div class="p-4 border-b border-slate-800 flex justify-between items-center">
        <h3 class="font-semibold text-emerald-400 text-sm">Document Inspector</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-white">&times;</button>
      </div>
      <pre id="modalJson" class="p-4 text-xs font-mono text-emerald-300 overflow-auto flex-1 custom-scroll"></pre>
    </div>
  </div>

  <script>
    const BASE_URL = '${BASE_PATH}';
    let activeModel = '';
    let currentPage = 1;

    async function loadModels() {
      const res = await fetch(BASE_URL + '/api/models');
      const models = await res.json();
      const container = document.getElementById('modelList');
      container.innerHTML = '';
      models.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'w-full flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-slate-800/80 text-left transition';
        btn.innerHTML = '<span>' + m.name + '</span><span class="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">' + m.count + '</span>';
        btn.onclick = () => selectModel(m.name);
        container.appendChild(btn);
      });
      if (models.length > 0) selectModel(models[0].name);
    }

    async function selectModel(name, page = 1) {
      activeModel = name;
      currentPage = page;
      document.getElementById('currentModel').innerText = name;
      document.getElementById('pageIndicator').innerText = 'Page ' + page;

      const res = await fetch(BASE_URL + '/api/data/' + name + '?page=' + page);
      const data = await res.json();

      document.getElementById('recordCount').innerText = data.total + ' records';
      document.getElementById('prevBtn').disabled = (currentPage <= 1);
      document.getElementById('nextBtn').disabled = (currentPage * data.limit >= data.total);

      renderTable(data.docs);
    }

    function renderTable(docs) {
      const container = document.getElementById('tableContainer');
      if (!docs || docs.length === 0) {
        container.innerHTML = '<div class="h-full flex items-center justify-center text-slate-500">No documents in this collection</div>';
        return;
      }

      const allKeys = Array.from(new Set(docs.flatMap(d => Object.keys(d))));
      const keys = ['_id', ...allKeys.filter(k => k !== '_id' && k !== '__v')];

      let html = '<table class="w-full text-left text-xs border-collapse font-mono">';
      html += '<thead><tr class="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">';
      keys.forEach(k => {
        html += '<th class="p-3 whitespace-nowrap">' + k + '</th>';
      });
      html += '<th class="p-3 text-right">Action</th></tr></thead><tbody>';

      docs.forEach((doc, idx) => {
        const rowBg = idx % 2 === 0 ? 'bg-slate-900/60' : 'bg-slate-950/40';
        html += '<tr class="' + rowBg + ' border-b border-slate-800/50 hover:bg-emerald-950/20 transition">';
        keys.forEach(k => {
          let val = doc[k];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          if (typeof val === 'string' && val.length > 40) val = val.substring(0, 40) + '...';
          html += '<td class="p-3 whitespace-nowrap text-slate-300 max-w-xs truncate">' + (val !== undefined ? val : '') + '</td>';
        });
        html += '<td class="p-3 text-right"><button onclick=\\'inspectDoc(' + JSON.stringify(doc).replace(/'/g, "&#39;") + ')\\' class="text-xs text-emerald-400 hover:underline">Inspect</button></td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function inspectDoc(doc) {
      document.getElementById('modalJson').innerText = JSON.stringify(doc, null, 2);
      document.getElementById('modal').classList.remove('hidden');
      document.getElementById('modal').classList.add('flex');
    }

    function closeModal() {
      document.getElementById('modal').classList.add('hidden');
      document.getElementById('modal').classList.remove('flex');
    }

    document.getElementById('prevBtn').onclick = () => { if (currentPage > 1) selectModel(activeModel, currentPage - 1); };
    document.getElementById('nextBtn').onclick = () => { selectModel(activeModel, currentPage + 1); };

    loadModels();
  </script>
</body>
</html>
  `);
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('✅ Connected to DocumentDB');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Anytime Studio running at: http://localhost:${PORT}${BASE_PATH}`);
  });
}).catch(err => {
  console.error('❌ Connection error:', err.message);
});
