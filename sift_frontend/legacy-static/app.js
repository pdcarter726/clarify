const API_BASE = 'http://localhost:3000';
const TOKEN_KEY = 'sift_token';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HINT =
  'At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character.';

let currentRecipes = [];
let editingRecipeId = null;

function passwordError(password) {
  return PASSWORD_PATTERN.test(password) ? null : `Password is too weak. ${PASSWORD_HINT}`;
}

// ---------- API helper ----------

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg = data?.message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `Request failed (${res.status})`);
  }

  return data;
}

// ---------- messages ----------

const messageEl = document.getElementById('message');
let messageTimer = null;

function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => messageEl.classList.add('hidden'), 6000);
}

// ---------- auth state ----------

function isLoggedIn() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  render();
}

async function render() {
  const authSection = document.getElementById('auth-section');
  const guestPreviewSection = document.getElementById('guest-preview-section');
  const appSection = document.getElementById('app-section');
  const sessionInfo = document.getElementById('session-info');

  if (!isLoggedIn()) {
    authSection.classList.remove('hidden');
    guestPreviewSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    sessionInfo.classList.add('hidden');
    return;
  }

  authSection.classList.add('hidden');
  guestPreviewSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  sessionInfo.classList.remove('hidden');

  try {
    const me = await api('/users/me');
    document.getElementById('session-email').textContent = me.email;
    document.getElementById('update-account-form').email.value = me.email;
    await loadRecipes();
  } catch (err) {
    showMessage(err.message);
  }
}

// ---------- auth forms ----------

document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
document.getElementById('tab-signup').addEventListener('click', () => switchTab('signup'));

function switchTab(which) {
  document.getElementById('tab-login').classList.toggle('active', which === 'login');
  document.getElementById('tab-signup').classList.toggle('active', which === 'signup');
  document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', which !== 'signup');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const { accessToken } = await api('/auth/login', {
      auth: false,
      method: 'POST',
      body: { email: form.email.value, password: form.password.value },
    });
    localStorage.setItem(TOKEN_KEY, accessToken);
    form.reset();
    showMessage('Logged in.', 'success');
    render();
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const password = form.password.value;

  const pwErr = passwordError(password);
  if (pwErr) return showMessage(pwErr);
  if (password !== form.confirmPassword.value) return showMessage('Passwords do not match.');

  try {
    const { accessToken } = await api('/auth/signup', {
      auth: false,
      method: 'POST',
      body: { email: form.email.value, password },
    });
    localStorage.setItem(TOKEN_KEY, accessToken);
    form.reset();
    showMessage('Account created.', 'success');
    render();
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('logout-btn').addEventListener('click', logout);

// ---------- guest preview (no account required, view-only) ----------

document.getElementById('guest-preview-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById('guest-preview-result');
  resultEl.innerHTML = '';

  try {
    const recipe = await api('/extraction', {
      auth: false,
      method: 'POST',
      body: { url: form.url.value },
    });
    renderGuestPreview(recipe);
  } catch (err) {
    showMessage(err.message);
  }
});

function renderGuestPreview(recipe) {
  const resultEl = document.getElementById('guest-preview-result');
  resultEl.innerHTML = '';
  resultEl.appendChild(buildRecipeCard(recipe, { actions: false }));
}

// ---------- account management ----------

document.getElementById('update-account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = { currentPassword: form.currentPassword.value };
  if (form.email.value) body.email = form.email.value;
  if (form.password.value) {
    const pwErr = passwordError(form.password.value);
    if (pwErr) return showMessage(pwErr);
    body.password = form.password.value;
  }

  try {
    await api('/users/me', { method: 'PATCH', body });
    form.password.value = '';
    form.currentPassword.value = '';
    showMessage('Account updated.', 'success');
    render();
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('delete-account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (!confirm('Delete your account and all recipes? This cannot be undone.')) return;

  try {
    await api('/users/me', {
      method: 'DELETE',
      body: { currentPassword: form.currentPassword.value },
    });
    logout();
    showMessage('Account deleted.', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

// ---------- import from URL ----------

document.getElementById('import-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/recipes/import', { method: 'POST', body: { url: form.url.value } });
    form.reset();
    showMessage('Recipe imported.', 'success');
    await loadRecipes();
  } catch (err) {
    showMessage(err.message);
  }
});

// ---------- recipe form (create/edit) ----------

function addIngredientRow(values = {}) {
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <input type="text" placeholder="name" class="ing-name" value="${escapeAttr(values.name || '')}" required />
    <input type="text" placeholder="qty" class="ing-quantity" value="${escapeAttr(values.quantity || '')}" />
    <input type="text" placeholder="unit" class="ing-unit" value="${escapeAttr(values.unit || '')}" />
    <button type="button" class="row-remove">✕</button>
  `;
  row.querySelector('.row-remove').addEventListener('click', () => row.remove());
  document.getElementById('ingredients-rows').appendChild(row);
}

function addInstructionRow(text = '') {
  const row = document.createElement('div');
  row.className = 'instruction-row';
  row.innerHTML = `
    <input type="text" placeholder="step description" class="ins-text" value="${escapeAttr(text)}" required />
    <button type="button" class="row-remove">✕</button>
  `;
  row.querySelector('.row-remove').addEventListener('click', () => row.remove());
  document.getElementById('instructions-rows').appendChild(row);
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

document.getElementById('add-ingredient').addEventListener('click', () => addIngredientRow());
document.getElementById('add-instruction').addEventListener('click', () => addInstructionRow());

function resetRecipeForm() {
  editingRecipeId = null;
  const form = document.getElementById('recipe-form');
  form.reset();
  form.id.value = '';
  document.getElementById('ingredients-rows').innerHTML = '';
  document.getElementById('instructions-rows').innerHTML = '';
  document.getElementById('recipe-form-title').textContent = 'New recipe';
  document.getElementById('cancel-edit').classList.add('hidden');
}

document.getElementById('cancel-edit').addEventListener('click', resetRecipeForm);

document.getElementById('recipe-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  const ingredients = [...document.querySelectorAll('#ingredients-rows .ingredient-row')].map(
    (row, index) => ({
      name: row.querySelector('.ing-name').value,
      quantity: row.querySelector('.ing-quantity').value || undefined,
      unit: row.querySelector('.ing-unit').value || undefined,
      position: index,
    }),
  );

  const instructions = [...document.querySelectorAll('#instructions-rows .instruction-row')].map(
    (row, index) => ({
      stepNumber: index + 1,
      text: row.querySelector('.ins-text').value,
    }),
  );

  const body = {
    title: form.title.value,
    servings: form.servings.value || undefined,
    prepTime: form.prepTime.value || undefined,
    cookTime: form.cookTime.value || undefined,
    imageUrl: form.imageUrl.value || undefined,
    ingredients,
    instructions,
  };

  try {
    if (editingRecipeId) {
      await api(`/recipes/${editingRecipeId}`, { method: 'PATCH', body });
      showMessage('Recipe updated.', 'success');
    } else {
      await api('/recipes', { method: 'POST', body });
      showMessage('Recipe created.', 'success');
    }
    resetRecipeForm();
    await loadRecipes();
  } catch (err) {
    showMessage(err.message);
  }
});

function startEditRecipe(recipe) {
  editingRecipeId = recipe.id;
  const form = document.getElementById('recipe-form');
  form.id.value = recipe.id;
  form.title.value = recipe.title || '';
  form.servings.value = recipe.servings || '';
  form.prepTime.value = recipe.prepTime || '';
  form.cookTime.value = recipe.cookTime || '';
  form.imageUrl.value = recipe.imageUrl || '';

  document.getElementById('ingredients-rows').innerHTML = '';
  document.getElementById('instructions-rows').innerHTML = '';
  (recipe.ingredients || []).forEach((ing) => addIngredientRow(ing));
  (recipe.instructions || []).forEach((step) => addInstructionRow(step.text));

  document.getElementById('recipe-form-title').textContent = `Editing: ${recipe.title}`;
  document.getElementById('cancel-edit').classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth' });
}

// ---------- recipe list ----------

document.getElementById('refresh-recipes').addEventListener('click', loadRecipes);

async function loadRecipes() {
  try {
    currentRecipes = await api('/recipes');
    renderRecipes();
  } catch (err) {
    showMessage(err.message);
  }
}

function renderRecipes() {
  const list = document.getElementById('recipes-list');
  list.innerHTML = '';

  if (currentRecipes.length === 0) {
    list.innerHTML = '<p class="empty-state">No recipes yet. Create one above or import from a URL.</p>';
    return;
  }

  for (const recipe of currentRecipes) {
    list.appendChild(buildRecipeCard(recipe, { actions: true }));
  }
}

// ---------- recipe card (shared by guest preview + saved list) ----------

// Unicode vulgar fractions normalized to "n/d" so they can be parsed and scaled.
const UNICODE_FRACTIONS = {
  '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6',
  '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};

const NICE_FRACTIONS = [
  [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'],
  [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'],
];

const QUANTITY_TOKEN = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/g;

function parseQuantityToken(token) {
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(token);
}

function formatScaledQuantity(value) {
  if (!isFinite(value)) return '';
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  const nice = NICE_FRACTIONS.find(([f]) => Math.abs(frac - f) < 0.03);
  if (nice) return whole > 0 ? `${whole} ${nice[1]}` : nice[1];
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function scaleQuantity(raw, factor) {
  if (!raw || factor === 1) return raw;
  // Fraction glyphs are often glued to a whole number ("1½"), so a preceding
  // digit needs a space inserted or "1" + "1/2" would merge into "11/2".
  const normalized = String(raw).replace(
    /(\d)?([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g,
    (_, digit, ch) => (digit ? `${digit} ${UNICODE_FRACTIONS[ch]}` : UNICODE_FRACTIONS[ch]),
  );
  return normalized.replace(QUANTITY_TOKEN, (token) => formatScaledQuantity(parseQuantityToken(token) * factor));
}

function sourceHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function buildRecipeCard(recipe, { actions = false } = {}) {
  let scale = 1;

  const metaParts = [
    recipe.servings && `🍽️ ${recipe.servings}`,
    recipe.prepTime && `⏱️ Prep ${recipe.prepTime}`,
    recipe.cookTime && `🔥 Cook ${recipe.cookTime}`,
  ].filter(Boolean);
  const metaHtml = metaParts.map((m) => `<span class="pill">${escapeHtml(m)}</span>`).join('');

  const sourceHtml = recipe.sourceUrl
    ? `<a class="pill pill-link" href="${escapeAttr(recipe.sourceUrl)}" target="_blank" rel="noopener">🔗 ${escapeHtml(sourceHostname(recipe.sourceUrl))}</a>`
    : '';

  const imageHtml = recipe.imageUrl
    ? `<img class="recipe-image" src="${escapeAttr(recipe.imageUrl)}" alt="${escapeAttr(recipe.title)}" loading="lazy" />`
    : '';

  const hasIngredients = (recipe.ingredients || []).length > 0;
  const instructionsHtml = (recipe.instructions || [])
    .map((s) => `<li>${escapeHtml(s.text)}</li>`)
    .join('');

  const card = document.createElement('article');
  card.className = 'recipe-card';
  card.innerHTML = `
    ${imageHtml}
    <div class="recipe-body">
      <h3>${escapeHtml(recipe.title)}</h3>
      ${metaHtml || sourceHtml ? `<div class="recipe-meta">${metaHtml}${sourceHtml}</div>` : ''}
      ${hasIngredients ? `
        <div class="recipe-section">
          <div class="section-row">
            <h4>Ingredients</h4>
            <div class="scale-control">
              <div class="scale-buttons">
                <button type="button" class="scale-btn active" data-scale="1">1x</button>
                <button type="button" class="scale-btn" data-scale="2">2x</button>
                <button type="button" class="scale-btn" data-scale="3">3x</button>
              </div>
              <input type="number" class="scale-custom" min="0.25" step="0.25" placeholder="custom" title="Custom scale" />
            </div>
          </div>
          <ul class="ingredients-list"></ul>
        </div>
      ` : ''}
      ${instructionsHtml ? `
        <div class="recipe-section">
          <h4>Instructions</h4>
          <ol class="instructions-list">${instructionsHtml}</ol>
        </div>
      ` : ''}
      ${actions ? `
        <div class="recipe-actions">
          <button type="button" class="secondary small" data-action="edit">Edit</button>
          <button type="button" class="danger small" data-action="delete">Delete</button>
        </div>
      ` : `<div class="save-nudge">Log in or sign up above to save this recipe to your collection.</div>`}
    </div>
  `;

  if (imageHtml) {
    card.querySelector('.recipe-image').addEventListener('error', (e) => e.target.remove());
  }

  function renderIngredients() {
    const listEl = card.querySelector('.ingredients-list');
    if (!listEl) return;
    listEl.innerHTML = (recipe.ingredients || [])
      .map((i) => `<li>${escapeHtml([scaleQuantity(i.quantity, scale), i.unit, i.name].filter(Boolean).join(' '))}</li>`)
      .join('');
  }
  renderIngredients();

  const scaleButtons = card.querySelectorAll('.scale-btn');
  const customInput = card.querySelector('.scale-custom');

  scaleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      scale = Number(btn.dataset.scale);
      scaleButtons.forEach((b) => b.classList.toggle('active', b === btn));
      if (customInput) customInput.value = '';
      renderIngredients();
    });
  });

  if (customInput) {
    customInput.addEventListener('input', () => {
      const value = parseFloat(customInput.value);
      if (!value || value <= 0) return;
      scale = value;
      scaleButtons.forEach((b) => b.classList.remove('active'));
      renderIngredients();
    });
  }

  if (actions) {
    card.querySelector('[data-action="edit"]').addEventListener('click', () => startEditRecipe(recipe));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteRecipe(recipe.id));
  }

  return card;
}

async function deleteRecipe(id) {
  if (!confirm('Delete this recipe?')) return;
  try {
    await api(`/recipes/${id}`, { method: 'DELETE' });
    showMessage('Recipe deleted.', 'success');
    await loadRecipes();
  } catch (err) {
    showMessage(err.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- init ----------

render();
