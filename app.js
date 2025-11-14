document.addEventListener('DOMContentLoaded', () => {

    let fuse;
    let productData = [];
    let currentSort = 'relevance';
    
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
    
    // --- New Element ---
    const resultCountEl = document.getElementById('result-count');
    // --- End New Element ---

    const MAX_RECENT = 5;

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
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
        const query = e.target.value;
        updateDisplay(query);
    });

    resultsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card) {
            const productId = card.dataset.id;
            const product = productData.find(p => p.id === productId);
            if (product) {
                addRecentItem(product);
            }
        }
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        const query = searchBar.value;
        updateDisplay(query);
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
        .then(data => {
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
            updateDisplay();
        })
        .catch(error => {
            console.error("Error fetching product data:", error);
            resultsContainer.innerHTML = "<p>Error loading product data. Please check console.</p>";
        });


    function updateDisplay(query = '') {
        if (query.length === 0) {
            const sortedProducts = sortProducts(productData, currentSort);
            displayAllProducts(sortedProducts);
        } else {
            const results = fuse.search(query);
            const sortedResults = sortProducts(results, currentSort);
            displayResults(sortedResults);
        }
    }

    function sortProducts(array, method) {
        const isFuseResult = array.length > 0 && array[0].hasOwnProperty('item');

        if (method === 'name-az') {
            return array.sort((a, b) => {
                const nameA = isFuseResult ? a.item.name : a.name;
                const nameB = isFuseResult ? b.item.name : b.name;
                return nameA.localeCompare(nameB);
            });
        } else if (method === 'name-za') {
            return array.sort((a, b) => {
                const nameA = isFuseResult ? a.item.name : a.name;
                const nameB = isFuseResult ? b.item.name : b.name;
                return nameB.localeCompare(nameA);
            });
        }
        
        return array;
    }

    function setTheme(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'enabled');
            themeToggle.innerHTML = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'disabled');
            themeToggle.innerHTML = '🌙';
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
        recentItems.unshift({
            id: product.id,
            name: product.name,
            link: product.link,
            image_url: product.image_url
        });
    
        recentItems = recentItems.slice(0, MAX_RECENT);
        localStorage.setItem('recentlyViewed', JSON.stringify(recentItems));
        loadRecentItems();
    }
    
    function highlight(text, matches, key) {
        if (!matches) {
            return text;
        }
        const keyMatches = matches.find(m => m.key === key);
        if (!keyMatches) {
            return text;
        }
        const indices = keyMatches.indices;
        if (!indices || indices.length === 0) {
            return text;
        }
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
    
    function displayResults(results) {
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultCountEl.textContent = 'No matches found';
            return;
        }

        // --- Add this line ---
        resultCountEl.textContent = `Found ${results.length} ${results.length === 1 ? 'match' : 'matches'}`;
    
        const cardsHTML = results.map(result => {
            const product = result.item;
            const matches = result.matches;
            const score = result.score; 
            const showHighlight = score < 0.1;
            const highlightedName = showHighlight ? highlight(product.name, matches, 'name') : product.name;
            const highlightedId = showHighlight ? highlight(product.id, matches, 'id') : product.id;
    
            return `
                <a href="${product.link}" target="_blank" class="product-card" data-id="${product.id}">
                    <img data-src="${product.image_url}" alt="${product.name}" class="lazy-load">
                    <div class="product-card-info">
                        <h3>${highlightedName}</h3>
                        <p>ID: ${highlightedId}</p>
                    </div>
                </a>
            `;
        });
    
        resultsContainer.innerHTML = cardsHTML.join(''); 
        const images = resultsContainer.querySelectorAll('img.lazy-load');
        images.forEach(img => lazyImageObserver.observe(img));
    }
    
    function displayAllProducts(products) {
        resultCountEl.textContent = `Showing ${products.length} of ${productData.length} products`;

        const cardsHTML = products.map(product => {
            return `
                <a href="${product.link}" target="_blank" class="product-card" data-id="${product.id}">
                    <img data-src="${product.image_url}" alt="${product.name}" class="lazy-load">
                    <div class="product-card-info">
                        <h3>${product.name}</h3>
                        <p>ID: ${product.id}</p>
                    </div>
                </a>
            `;
        });
        
        resultsContainer.innerHTML = cardsHTML.join('');
        const images = resultsContainer.querySelectorAll('img.lazy-load');
        images.forEach(img => lazyImageObserver.observe(img));
    }

});