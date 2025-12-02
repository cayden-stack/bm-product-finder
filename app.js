const SUPABASE_URL = PUBLIC_SUPABASE_URL; 
const SUPABASE_ANON_KEY = PUBLIC_SUPABASE_ANON_KEY; 
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {

    let fuse;
    let productData = [];
    let filteredData = []; 
    let currentSort = 'relevance';
    let showingFavoritesOnly = false;
    let session = null; 
    let isLoginMode = true; 
    
    let currentPage = 1;
    const itemsPerPage = 40; 

    const themeToggle = document.getElementById('theme-toggle-btn');
    const searchBar = document.getElementById('search-bar');
    const resultsContainer = document.getElementById('results-container');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    const recentList = document.getElementById('recent-list');
    
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const pageContainer = document.querySelector('.page-container');
    const sortSelect = document.getElementById('sort-select');
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    const resultCountEl = document.getElementById('result-count');
    const favoritesFilterBtn = document.getElementById('favorites-filter-btn');

    const authBtn = document.getElementById('auth-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuth = document.getElementById('close-auth');
    const submitAuth = document.getElementById('submit-auth');
    const googleAuthBtn = document.getElementById('google-auth-btn');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const authTitle = document.getElementById('auth-title');
    const switchAuthMode = document.getElementById('switch-auth-mode');

    const MAX_RECENT = 5;

    const observerOptions = { root: null, rootMargin: '200px', threshold: 0.1 };
    const lazyImageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                img.classList.remove('lazy-load');
                observer.unobserve(img);
            }
        });
    }, observerOptions);

    const scrollTrigger = document.createElement('div');
    scrollTrigger.className = 'scroll-trigger';
    scrollTrigger.style.height = '20px';
    
    const scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadMoreProducts();
        }
    }, { root: null, rootMargin: '300px' });

    const isDarkMode = localStorage.getItem('darkMode') === 'enabled';
    setTheme(isDarkMode);
    loadRecentItems();

    if (themeToggle) themeToggle.addEventListener('click', () => setTheme(!localStorage.getItem('darkMode') === 'enabled'));
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', () => { 
        if(pageContainer) pageContainer.classList.toggle('sidebar-open'); 
        sidebarToggleBtn.classList.toggle('active'); 
    });

    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) alert("Google Login Failed: " + error.message);
        });
    }

    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (session) {
                supabase.auth.signOut(); 
            } else {
                authModal.classList.add('show');
            }
        });
    }

    if (closeAuth) closeAuth.addEventListener('click', () => authModal.classList.remove('show'));

    if (switchAuthMode) {
        switchAuthMode.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            authTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
            submitAuth.textContent = isLoginMode ? 'Login' : 'Sign Up';
            switchAuthMode.textContent = isLoginMode ? 'Need an account? Sign Up' : 'Have an account? Login';
        });
    }

    if (submitAuth) {
        submitAuth.addEventListener('click', async () => {
            const email = emailInput.value;
            const password = passInput.value;
            let error;
            submitAuth.textContent = "Loading...";

            if (isLoginMode) {
                const res = await supabase.auth.signInWithPassword({ email, password });
                error = res.error;
            } else {
                const res = await supabase.auth.signUp({ email, password });
                error = res.error;
            }
            submitAuth.textContent = isLoginMode ? 'Login' : 'Sign Up';

            if (error) {
                alert(error.message);
            } else {
                authModal.classList.remove('show');
                if (!isLoginMode) alert("Check your email to confirm sign up!");
            }
        });
    }

    supabase.auth.onAuthStateChange((event, _session) => {
        session = _session;
        if (authBtn) authBtn.textContent = session ? 'Logout' : 'Login';
        
        if (session && productData.length > 0) {
            fetchFavorites().then(favoritesList => {
                const favoritedProductIds = new Set(favoritesList.map(f => f.product_id));
                productData.forEach(product => {
                    product.isFavorited = favoritedProductIds.has(product.id);
                });
                updateDisplay(searchBar.value);
            });
        } else if (!session && productData.length > 0) {
             productData.forEach(product => product.isFavorited = false);
             updateDisplay(searchBar.value);
        }
    });

    if (favoritesFilterBtn) {
        favoritesFilterBtn.addEventListener('click', () => {
            showingFavoritesOnly = !showingFavoritesOnly;
            favoritesFilterBtn.classList.toggle('active');
            favoritesFilterBtn.textContent = showingFavoritesOnly ? "Show All" : "Show Favorites";
            updateDisplay(searchBar ? searchBar.value : '');
        });
    }

    if (gridViewBtn && listViewBtn) {
        gridViewBtn.addEventListener('click', () => {
            if (resultsContainer) resultsContainer.classList.remove('list-view');
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        });
        listViewBtn.addEventListener('click', () => {
            if (resultsContainer) resultsContainer.classList.add('list-view');
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
        });
    }

    if (searchBar) searchBar.addEventListener('input', (e) => updateDisplay(e.target.value));
    
    if (sortSelect) sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        updateDisplay(searchBar ? searchBar.value : '');
    });

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        });
    }

    window.onscroll = () => {
        if (scrollTopBtn) {
            if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
                scrollTopBtn.classList.add('show');
            } else {
                scrollTopBtn.classList.remove('show');
            }
        }
    };

    if (resultsContainer) {
        resultsContainer.addEventListener('click', async (e) => {
            const starBtn = e.target.closest('.favorite-btn');
            if (starBtn) {
                e.preventDefault(); e.stopPropagation();
                
                if (!session) {
                    alert("Please log in to save favorites.");
                    authModal.classList.add('show');
                    return;
                }

                const productId = starBtn.dataset.productId;
                const product = productData.find(p => (p.id === productId) || (p.product_sku === productId));
                
                if (!product) return;

                const isFavorited = starBtn.dataset.favorited === 'true';
                const newStatus = !isFavorited;

                starBtn.classList.toggle('favorited');
                starBtn.dataset.favorited = newStatus;
                starBtn.innerHTML = newStatus ? '★' : '☆';

                product.isFavorited = newStatus;
                
                if (showingFavoritesOnly && !newStatus) updateDisplay(searchBar.value);

                const success = await toggleFavorite(productId, isFavorited);
                if (!success) {
                    starBtn.classList.toggle('favorited');
                    starBtn.dataset.favorited = isFavorited;
                    product.isFavorited = isFavorited;
                    alert("Error saving favorite");
                }
                return;
            }

            const card = e.target.closest('.product-card');
            if (card) {
                const productId = card.dataset.id;
                const product = productData.find(p => (p.id === productId) || (p.product_sku === productId));
                if (product) addRecentItem(product);
            }
        });
    }

    fetch('products.json')
        .then(response => response.json())
        .then(async data => {
            productData = data.map(p => ({
                ...p,
                id: p.id || p.product_sku || "unknown-id",
                name: p.name || p.product_name,
                image_url: p.image_url || p.image
            }));

            const options = { 
                includeScore: true, 
                includeMatches: true, 
                threshold: 0.3, 
                useExtendedSearch: true,
                keys: [
                    { name: 'name', weight: 2 },
                    { name: 'product_sku', weight: 5 },
                    { name: 'id', weight: 5 }, 
                    { name: 'tags', weight: 1 }
                ] 
            };
            fuse = new Fuse(productData, options);

            if (session) {
                const favoritesList = await fetchFavorites();
                const favoritedProductIds = new Set(favoritesList.map(f => f.product_id));
                productData = productData.map(p => ({ ...p, isFavorited: favoritedProductIds.has(p.id) }));
            } else {
                productData = productData.map(p => ({ ...p, isFavorited: false }));
            }

            updateDisplay();
        })
        .catch(error => console.error(error));


    const API_BASE_URL = '/api/favorites';

    async function fetchFavorites() {
        if (!session) return [];
        try {
            const response = await fetch(API_BASE_URL, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}` 
                },
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.favorites || [];
        } catch (error) { return []; }
    }

    async function toggleFavorite(productId, isFavorited) {
        if (!session) return false;
        try {
            const method = isFavorited ? 'DELETE' : 'POST';
            const response = await fetch(API_BASE_URL, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ product_id: productId })
            });
            return response.ok;
        } catch (error) { return false; }
    }

    function updateDisplay(query = '') {
        currentPage = 1;
        
        if (query.length === 0) {
            filteredData = productData;
        } else {
            filteredData = fuse.search(query).map(r => { 
                const item = r.item;
                return item; 
            });
        }

        if (showingFavoritesOnly) {
            filteredData = filteredData.filter(p => p.isFavorited);
        }

        filteredData = sortProducts(filteredData, currentSort);
        renderInitialBatch(query.length > 0);
    }

    function renderInitialBatch(isSearch) {
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        
        if (resultCountEl) {
            if (showingFavoritesOnly) resultCountEl.textContent = `Showing ${filteredData.length} favorites`;
            else if (isSearch) resultCountEl.textContent = `Found ${filteredData.length} matches`;
            else resultCountEl.textContent = `Showing ${filteredData.length} products`;
        }

        if (filteredData.length === 0) { 
            if (resultCountEl) resultCountEl.textContent = 'No matches found'; 
            return; 
        }

        resultsContainer.appendChild(scrollTrigger);
        scrollObserver.observe(scrollTrigger);
        loadMoreProducts(); 
    }

    function loadMoreProducts() {
        const start = (currentPage - 1) * itemsPerPage;
        const end = currentPage * itemsPerPage;
        
        if (start >= filteredData.length) {
            scrollObserver.unobserve(scrollTrigger);
            return;
        }

        const itemsToRender = filteredData.slice(start, end);
        scrollTrigger.remove();
        const cardsHTML = itemsToRender.map(product => createProductCard(product)).join('');
        resultsContainer.insertAdjacentHTML('beforeend', cardsHTML);
        resultsContainer.appendChild(scrollTrigger);

        const images = resultsContainer.querySelectorAll('img.lazy-load:not(.loaded)');
        images.forEach(img => lazyImageObserver.observe(img));

        currentPage++;
    }

    function createProductCard(product) {
        let displayName = product.name;
        let displayId = product.id || "N/A";
        const query = searchBar.value.trim();
        
        if (query.length > 0) {
             displayName = highlight(displayName, query);
             displayId = highlight(displayId, query);
        }

        const starIcon = product.isFavorited ? '★' : '☆';
        const favClass = product.isFavorited ? 'favorited' : '';
        const displayPrice = product.price ? product.price : '';

        return `
            <a href="${product.product_link || product.link}" target="_blank" class="product-card" data-id="${product.id}">
                <button class="favorite-btn ${favClass}" data-product-id="${product.id}" data-favorited="${product.isFavorited}">${starIcon}</button>
                <img data-src="${product.image_url}" alt="${product.name}" class="lazy-load">
                <div class="product-card-info">
                    <h3>${displayName}</h3>
                    <p class="sku">ID: ${displayId}</p>
                    <p class="price">${displayPrice}</p>
                </div>
            </a>
        `;
    }

    function sortProducts(array, method) {
        const sorted = [...array];
        if (method === 'name-az') return sorted.sort((a, b) => a.name.localeCompare(b.name));
        if (method === 'name-za') return sorted.sort((a, b) => b.name.localeCompare(a.name));
        return sorted;
    }

    function setTheme(isDark) {
        if (isDark) { document.body.classList.add('dark-mode'); localStorage.setItem('darkMode', 'enabled'); if(themeToggle) themeToggle.innerHTML = '☀️'; } 
        else { document.body.classList.remove('dark-mode'); localStorage.setItem('darkMode', 'disabled'); if(themeToggle) themeToggle.innerHTML = '🌙'; }
    }
    
    function loadRecentItems() {
        const items = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        if (!recentList) return;
        recentList.innerHTML = '';
        if (items.length === 0) { recentList.innerHTML = '<li>No recent items.</li>'; return; }
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${item.product_link || item.link}" target="_blank"><img src="${item.image_url}" alt="${item.name}" class="recent-item-img"><div class="recent-item-info">${item.name}<span>ID: ${item.id}</span></div></a>`;
            recentList.appendChild(li);
        });
    }
    
    function addRecentItem(product) {
        let items = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        items = items.filter(i => i.id !== product.id);
        items.unshift(product);
        items = items.slice(0, MAX_RECENT);
        localStorage.setItem('recentlyViewed', JSON.stringify(items));
        loadRecentItems();
    }

    function highlight(text, query) {
        if (!query || !text) return text;
        
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        
        return text.toString().replace(regex, '<mark>$1</mark>');
    }

});