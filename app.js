document.addEventListener('DOMContentLoaded', () => {

    let fuse;
    let productData = [];
    let currentSort = 'relevance';
    let showingFavoritesOnly = false;
    
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

    const MAX_RECENT = 5;

    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
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

    
    const isDarkMode = localStorage.getItem('darkMode') === 'enabled';
    setTheme(isDarkMode);
    loadRecentItems();

    themeToggle.addEventListener('click', () => {
        const isDarkMode = localStorage.getItem('darkMode') === 'enabled';
        setTheme(!isDarkMode);
    });

    sidebarToggleBtn.addEventListener('click', () => {
        pageContainer.classList.toggle('sidebar-open');
        sidebarToggleBtn.classList.toggle('active');
    });

    favoritesFilterBtn.addEventListener('click', () => {
        showingFavoritesOnly = !showingFavoritesOnly;
        favoritesFilterBtn.classList.toggle('active');
        
        if (showingFavoritesOnly) {
            favoritesFilterBtn.textContent = "Show All";
        } else {
            favoritesFilterBtn.textContent = "Show Favorites";
        }

        updateDisplay(searchBar.value);
    });

    gridViewBtn.addEventListener('click', () => {
        resultsContainer.classList.remove('list-view');
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    });

    listViewBtn.addEventListener('click', () => {
        resultsContainer.classList.add('list-view');
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    });

    searchBar.addEventListener('input', (e) => {
        updateDisplay(e.target.value);
    });

    resultsContainer.addEventListener('click', async (e) => {

        const starBtn = e.target.closest('.favorite-btn');
        if (starBtn) {
            e.preventDefault();
            e.stopPropagation();

            const productId = starBtn.dataset.productId;
            const isFavorited = starBtn.dataset.favorited === 'true';
            const newStatus = !isFavorited;

            starBtn.classList.toggle('favorited');
            starBtn.dataset.favorited = newStatus;
            starBtn.innerHTML = newStatus ? '★' : '☆';

            const product = productData.find(p => p.id === productId);
            if (product) product.isFavorited = newStatus;

            if (showingFavoritesOnly && !newStatus) {
                updateDisplay(searchBar.value);
            }

            const success = await toggleFavorite(productId, isFavorited);
            if (!success) {
                starBtn.classList.toggle('favorited');
                starBtn.dataset.favorited = isFavorited;
                starBtn.innerHTML = isFavorited ? '★' : '☆';
                if (product) product.isFavorited = isFavorited;
                alert("Failed to save favorite.");
            }
            return;
        }

        const card = e.target.closest('.product-card');
        if (card) {
            const productId = card.dataset.id;
            const product = productData.find(p => p.id === productId);
            if (product) addRecentItem(product);
        }
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        updateDisplay(searchBar.value);
    });

    window.onscroll = () => {
        if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    };

    scrollTopBtn.addEventListener('click', () => {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    });

    fetch('products.json')
        .then(response => response.json())
        .then(async data => {
            productData = data;
            
            const options = {
                includeScore: true,
                includeMatches: true, 
                threshold: 0.4, 
                keys: [
                    { name: 'name', weight: 2 },
                    { name: 'id', weight: 2 },
                    { name: 'tags', weight: 1 }
                ]
            };
    
            fuse = new Fuse(productData, options);

            const favoritesList = await fetchFavorites();
            const favoritedProductIds = new Set(favoritesList.map(f => f.product_id));

            productData = productData.map(product => ({
                ...product,
                isFavorited: favoritedProductIds.has(product.id)
            }));

            updateDisplay();
        })
        .catch(error => {
            console.error("Error fetching product data:", error);
            resultsContainer.innerHTML = "<p>Error loading product data. Please check console.</p>";
        });


    const API_BASE_URL = '/api/favorites';

    async function fetchFavorites() {
        try {
            const response = await fetch(API_BASE_URL, { method: 'GET' });
            if (!response.ok) return [];
            const data = await response.json();
            return data.favorites || [];
        } catch (error) {
            return [];
        }
    }

    async function toggleFavorite(productId, isFavorited) {
        try {
            const method = isFavorited ? 'DELETE' : 'POST';
            const response = await fetch(API_BASE_URL, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: productId })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    function updateDisplay(query = '') {
        let results;

        if (query.length === 0) {
            results = productData;
        } else {
            results = fuse.search(query).map(result => {
                const item = result.item;
                item._matches = result.matches;
                item._score = result.score;
                return item;
            });
        }

        if (showingFavoritesOnly) {
            results = results.filter(p => p.isFavorited);
        }

        results = sortProducts(results, currentSort);
        displayProducts(results, query.length > 0);
    }

    function sortProducts(array, method) {
        if (method === 'name-az') {
            return array.sort((a, b) => a.name.localeCompare(b.name));
        } else if (method === 'name-za') {
            return array.sort((a, b) => b.name.localeCompare(a.name));
        }
        return array;
    }

    function displayProducts(products, isSearch) {
        resultsContainer.innerHTML = '';
        
        if (products.length === 0) {
            resultCountEl.textContent = 'No matches found';
            return;
        }

        if (showingFavoritesOnly) {
            resultCountEl.textContent = `Showing ${products.length} favorite${products.length !== 1 ? 's' : ''}`;
        } else if (isSearch) {
            resultCountEl.textContent = `Found ${products.length} match${products.length !== 1 ? 'es' : ''}`;
        } else {
            resultCountEl.textContent = `Showing ${products.length} products`;
        }

        const cardsHTML = products.map(product => {
            let displayName = product.name;
            let displayId = product.id;
            
            if (isSearch && product._score < 0.1 && !showingFavoritesOnly) {
                displayName = highlight(product.name, product._matches, 'name');
                displayId = highlight(product.id, product._matches, 'id');
            }

            const starIcon = product.isFavorited ? '★' : '☆';
            const favClass = product.isFavorited ? 'favorited' : '';

            return `
                <a href="${product.link}" target="_blank" class="product-card" data-id="${product.id}">
                    <button class="favorite-btn ${favClass}" 
                            data-product-id="${product.id}" 
                            data-favorited="${product.isFavorited}">
                        ${starIcon}
                    </button>
                    <img data-src="${product.image_url}" alt="${product.name}" class="lazy-load">
                    <div class="product-card-info">
                        <h3>${displayName}</h3>
                        <p>ID: ${displayId}</p>
                    </div>
                </a>
            `;
        });
        
        resultsContainer.innerHTML = cardsHTML.join('');
        
        const images = resultsContainer.querySelectorAll('img.lazy-load');
        images.forEach(img => lazyImageObserver.observe(img));
    }

    function setTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'enabled');
            themeToggle.innerHTML = '🌙';
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'disabled');
            themeToggle.innerHTML = '☀️';
        }
    }

    function loadRecentItems() {
        const recentItems = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        recentList.innerHTML = '';
        if (recentItems.length === 0) {
            recentList.innerHTML = '<li>No recent items.</li>';
            return;
        }
        recentItems.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="${item.link}" target="_blank">
                    <img src="${item.image_url}" alt="${item.name}" class="recent-item-img">
                    <div class="recent-item-info">
                        ${item.name}
                        <span>ID: ${item.id}</span>
                    </div>
                </a>
            `;
            recentList.appendChild(li);
        });
    }
    
    function addRecentItem(product) {
        let recentItems = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        recentItems = recentItems.filter(item => item.id !== product.id);
        recentItems.unshift({id: product.id, name: product.name, link: product.link, image_url: product.image_url});
        recentItems = recentItems.slice(0, MAX_RECENT);
        localStorage.setItem('recentlyViewed', JSON.stringify(recentItems));
        loadRecentItems();
    }

    function highlight(text, matches, key) {
        if (!matches) return text;
        const keyMatches = matches.find(m => m.key === key);
        if (!keyMatches) return text;
        const indices = keyMatches.indices;
        if (!indices || indices.length === 0) return text;
        let highlightedText = "";
        let lastIndex = 0;
        indices.forEach(pair => {
            const start = pair[0];
            const end = pair[1] + 1;
            highlightedText += text.substring(lastIndex, start);
            highlightedText += `<mark>${text.substring(start, end)}</mark>`;
            lastIndex = end;
        });
        highlightedText += text.substring(lastIndex);
        return highlightedText;
    }

});