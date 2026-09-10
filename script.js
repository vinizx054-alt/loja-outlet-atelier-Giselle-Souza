// ==================== CONFIGURAÇÕES GLOBAIS ====================
const IMGBB_API_KEY = "0aa004e6c07ec1c8d3f457f7e99db2b1";

const firebaseConfig = {
    apiKey: "AIzaSyCsULHsOiY0e25kl4_d9VwnXxBschgX4AA",
    authDomain: "outlet-giselle-souza.firebaseapp.com",
    projectId: "outlet-giselle-souza",
    storageBucket: "outlet-giselle-souza.firebasestorage.app",
    messagingSenderId: "1037972954540",
    appId: "1:1037972954540:web:31b98f44f621ac01ce6e09"
};

const firebaseReady = firebaseConfig.apiKey !== "SUBSTITUA_AQUI";
let db = null;

if (firebaseReady) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}

// ==================== DADOS INICIAIS ====================
const defaultProducts = [
    {
        id: "1",
        type: 'vestido',
        name: 'Vestido de Festa Longo Vermelho',
        price: 459.90,
        image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400',
        images: [],
        desc: 'Vestido longo em cetim premium com acabamento fino.\n\nTamanhos e Medidas:\n- Busto: 90 cm a 94 cm\n- Cintura: 72 cm a 76 cm\n- Quadril: Solto / Evasê\n- Comprimento: 155 cm (do ombro à barra)'
    },
    {
        id: "2",
        type: 'vestido',
        name: 'Vestido Midi Floral',
        price: 289.90,
        image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400',
        images: [],
        desc: 'Vestido midi floral leve com ajuste de amarração nas costas.\n\nMedidas:\n- Tamanho M (Veste 38-42)\n- Busto: até 98 cm\n- Cintura elástica'
    }
];

let products = [];
let currentModalImages = []; // Armazena as imagens do produto aberto na modal

let config = {
    whatsappNumber: '11999999999',
    whatsappMessage: 'Olá! Tenho interesse no produto: {produto} - Preço: R$ {preco}'
};

let lastDeletedProduct = null;
let undoTimeout = null;

let addFormFiles = []; 
let editFormFiles = []; 

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadConfig();
    setupImageUploadInputs();

    if (window.location.hash === '#admin') {
        openAdmin();
    }

    // Clique na foto principal do produto para abrir o zoom
    const mainDescImg = document.getElementById('desc-modal-img');
    if (mainDescImg) {
        mainDescImg.style.cursor = 'pointer';
        mainDescImg.onclick = function() {
            if (this.src) openZoomModal(this.src);
        };
    }
});

window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') {
        openAdmin();
    }
});

// ==================== AUTENTICAÇÃO E MODAL ADMIN ====================
function openAdmin() {
    const panel = document.getElementById('admin-panel');
    if (panel) panel.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAdmin() {
    const panel = document.getElementById('admin-panel');
    if (panel) panel.classList.remove('active');
    document.body.style.overflow = '';
}

function loginAdmin() {
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
        showToast("Por favor, preencha o e-mail e a senha.", "error");
        return;
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            showToast("Login realizado com sucesso!");
            if (passwordInput) passwordInput.value = '';
        })
        .catch((error) => {
            console.error("Erro na autenticação:", error);
            showToast("E-mail ou senha incorretos.", "error");
        });
}

function logoutAdmin() {
    firebase.auth().signOut().then(() => {
        showToast("Você saiu do painel.");
    }).catch((error) => {
        showToast("Erro ao tentar sair.", "error");
    });
}

// Monitora o estado da sessão do Firebase Auth
if (firebaseReady) {
    firebase.auth().onAuthStateChanged((user) => {
        const loginDiv = document.getElementById('admin-login');
        const dashboardDiv = document.getElementById('admin-dashboard');
        const userDisplay = document.getElementById('user-display');

        if (user) {
            if (loginDiv) loginDiv.classList.add('hidden');
            if (dashboardDiv) dashboardDiv.classList.remove('hidden');
            if (userDisplay) userDisplay.textContent = `Logado como: ${user.email}`;
            renderAdminProducts();
        } else {
            if (loginDiv) loginDiv.classList.remove('hidden');
            if (dashboardDiv) dashboardDiv.classList.add('hidden');
            if (userDisplay) userDisplay.textContent = '';
        }
    });
}

function switchTab(tab, evt) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (evt && evt.target) {
        evt.target.classList.add('active');
    }
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    if (tab === 'list') renderAdminProducts();
}

// ==================== CARREGAMENTO E MANTENIMENTO DE DADOS ====================
function loadProducts() {
    if (firebaseReady) {
        db.collection('products').onSnapshot(snapshot => {
            if (!snapshot.empty) {
                products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                defaultProducts.forEach(async (p) => {
                    await db.collection('products').doc(String(p.id)).set(p);
                });
                products = [...defaultProducts];
            }
            renderProducts();
            renderAdminProducts();
        }, error => {
            console.error('Erro ao conectar ao Firebase:', error);
            showToast('Erro de conexão online. Mostrando salvamento local.', 'error');
            products = JSON.parse(localStorage.getItem('storeProducts')) || defaultProducts;
            renderProducts();
            renderAdminProducts();
        });
    } else {
        products = JSON.parse(localStorage.getItem('storeProducts')) || defaultProducts;
        renderProducts();
        renderAdminProducts();
    }
}

// ==================== RENDERIZAÇÃO DA VITRINE ====================
function renderProducts() {
    const vestidosGrid = document.getElementById('vestidos-grid');
    const tecidosGrid = document.getElementById('tecidos-grid');

    const vestidos = products.filter(p => p.type === 'vestido');
    const tecidos = products.filter(p => p.type === 'tecido');

    if (vestidosGrid) {
        vestidosGrid.innerHTML = vestidos.length ? vestidos.map(p => createProductCard(p)).join('') : emptyState();
    }
    if (tecidosGrid) {
        tecidosGrid.innerHTML = tecidos.length ? tecidos.map(p => createProductCard(p)).join('') : emptyState();
    }
}

function createProductCard(product) {
    const galleryImages = (product.images && product.images.length)
        ? [product.image, ...product.images]
        : [product.image];
    const imagesAttr = encodeURIComponent(JSON.stringify(galleryImages));

    return `
        <div class="product-card" data-images="${imagesAttr}" onmouseenter="startImageHover(this)" onmouseleave="stopImageHover(this)">
            <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/400x400?text=Sem+Imagem'">
            <div class="product-info">
                <div class="product-category">${product.type === 'vestido' ? 'Vestido' : 'Tecido'}</div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">R$ ${Number(product.price).toFixed(2)}</div>
                
                <div class="product-actions" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn" onclick="openDescModal('${product.id}')" style="background: #f0f0f0; color: #333; justify-content: center; width: 100%; border: 1px solid #ccc; font-size: 0.88rem;">
                        <i class="fas fa-file-alt"></i> Ver Descrição
                    </button>
                    <button class="btn btn-whatsapp" onclick="openBuyModal('${product.name}', ${product.price}, '${product.image}')" style="justify-content: center; width: 100%;">
                        <i class="fab fa-whatsapp"></i> Comprar
                    </button>
                </div>
            </div>
        </div>
    `;
}

const hoverGalleries = new Map();

function startImageHover(card) {
    let images;
    try {
        images = JSON.parse(decodeURIComponent(card.dataset.images));
    } catch (e) {
        return;
    }

    if (!images || images.length <= 1) return;

    const imgEl = card.querySelector('.product-image');
    const originalSrc = imgEl.src;
    let index = 0;
    let brokenCount = 0;

    const errorHandler = () => {
        brokenCount++;
        if (brokenCount >= images.length) {
            clearInterval(interval);
            imgEl.src = originalSrc;
            return;
        }
        index = (index + 1) % images.length;
        imgEl.src = images[index];
    };
    imgEl.addEventListener('error', errorHandler);

    const interval = setInterval(() => {
        index = (index + 1) % images.length;
        imgEl.src = images[index];
    }, 2000);

    hoverGalleries.set(card, { interval, imgEl, originalSrc, errorHandler });
}

function stopImageHover(card) {
    const gallery = hoverGalleries.get(card);
    if (gallery) {
        clearInterval(gallery.interval);
        gallery.imgEl.removeEventListener('error', gallery.errorHandler);
        gallery.imgEl.src = gallery.originalSrc;
        hoverGalleries.delete(card);
    }
}

function emptyState() {
    return `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <i class="fas fa-box-open"></i>
            <h3>Nenhum produto cadastrado</h3>
            <p>Adicione produtos pelo painel administrativo</p>
        </div>
    `;
}

// ==================== MODAL DE DESCRIÇÃO E GALERIA ====================
function openDescModal(productId) {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product) return;

    const mainImg = product.image;
    const extraImgs = product.images || [];
    currentModalImages = [mainImg, ...extraImgs].filter(Boolean);

    const imgEl = document.getElementById('desc-modal-img');
    if (imgEl) imgEl.src = mainImg;

    const moreBtn = document.getElementById('more-photos-btn');
    const galleryContainer = document.getElementById('gallery-expanded-container');
    if (galleryContainer) galleryContainer.style.display = 'none';

    if (moreBtn) {
        moreBtn.style.display = currentModalImages.length > 1 ? 'flex' : 'none';
    }

    const titleEl = document.getElementById('desc-modal-title');
    const priceEl = document.getElementById('desc-modal-price');
    const descEl = document.getElementById('desc-modal-text');

    if (titleEl) titleEl.textContent = product.name;
    if (priceEl) priceEl.textContent = `R$ ${Number(product.price).toFixed(2)}`;
    if (descEl) descEl.textContent = product.desc || 'Nenhuma descrição ou medida informada para este produto.';

    const buyBtn = document.getElementById('desc-modal-buy-btn');
    if (buyBtn) {
        buyBtn.onclick = () => {
            closeDescModal();
            openBuyModal(product.name, product.price, product.image);
        };
    }

    const modal = document.getElementById('desc-modal');
    if (modal) modal.classList.add('active');
}

function toggleGalleryView() {
    const container = document.getElementById('gallery-expanded-container');
    if (!container) return;

    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        renderGalleryThumbs(currentModalImages);
    } else {
        container.style.display = 'none';
    }
}

function renderGalleryThumbs(imagesList) {
    const container = document.getElementById('gallery-thumbs-list');
    if (!container) return;

    container.innerHTML = '';

    imagesList.forEach((url, index) => {
        const thumb = document.createElement('img');
        thumb.src = url;
        thumb.alt = `Foto ${index + 1}`;
        thumb.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid #ccc; transition: transform 0.2s, border-color 0.2s; flex-shrink: 0;';
        
        thumb.onmouseover = () => { 
            thumb.style.borderColor = '#8B263E'; 
            thumb.style.transform = 'scale(1.05)';
        };
        thumb.onmouseout = () => { 
            thumb.style.borderColor = '#ccc'; 
            thumb.style.transform = 'scale(1)';
        };

        thumb.onclick = () => {
            openZoomModal(url);
        };

        container.appendChild(thumb);
    });
}

function closeDescModal() {
    const modal = document.getElementById('desc-modal');
    if (modal) modal.classList.remove('active');
}

// ==================== MODAL DE ZOOM DE IMAGEM ====================
function openZoomModal(imageSrc) {
    const zoomModal = document.getElementById('image-zoom-modal');
    const zoomImg = document.getElementById('zoomed-image');
    
    if (zoomModal && zoomImg) {
        zoomImg.src = imageSrc;
        zoomModal.style.display = 'flex';
    }
}

function closeZoomModal() {
    const zoomModal = document.getElementById('image-zoom-modal');
    if (zoomModal) {
        zoomModal.style.display = 'none';
    }
}

// ==================== SERVIÇO DE UPLOAD (IMGBB) ====================
async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    if (data.success) {
        return data.data.url;
    } else {
        throw new Error("Falha ao enviar imagem para o ImgBB.");
    }
}

// ==================== CONTROLE DE INPUTS DE UPLOAD ====================
function setupImageUploadInputs() {
    const input = document.getElementById('product-image-file');
    if (input) {
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            addFormFiles.push(...files);
            renderFormPreviews('product-gallery-preview', addFormFiles);
            input.value = '';
        });
    }

    const editInput = document.getElementById('edit-product-image-file');
    if (editInput) {
        editInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            editFormFiles.push(...files);
            renderFormPreviews('edit-product-gallery-preview', editFormFiles);
            editInput.value = '';
        });
    }
}

function renderFormPreviews(containerId, filesOrUrls) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = filesOrUrls.map((item, i) => {
        const src = (typeof item === 'string') ? item : URL.createObjectURL(item);
        return `
            <div style="position: relative; display: inline-block; margin: 4px;">
                <img src="${src}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc;">
                <span style="position: absolute; bottom: 2px; left: 2px; background: rgba(0,0,0,0.6); color: white; font-size: 10px; padding: 2px 4px; border-radius: 3px;">
                    ${i === 0 ? 'Principal' : `#${i+1}`}
                </span>
                <button type="button" onclick="removeSelectedFile('${containerId}', ${i})"
                    style="position: absolute; top: -5px; right: -5px; background: #EF4444; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; cursor: pointer; line-height: 1;">×</button>
            </div>
        `;
    }).join('');
}

function removeSelectedFile(containerId, index) {
    if (containerId === 'product-gallery-preview') {
        addFormFiles.splice(index, 1);
        renderFormPreviews(containerId, addFormFiles);
    } else {
        editFormFiles.splice(index, 1);
        renderFormPreviews(containerId, editFormFiles);
    }
}

// ==================== ADICIONAR E EDITAR PRODUTOS ====================
async function addProduct() {
    const type = document.getElementById('product-type')?.value;
    const name = document.getElementById('product-name')?.value.trim();
    const price = parseFloat(document.getElementById('product-price')?.value);
    const desc = document.getElementById('product-desc')?.value.trim();
    
    const rawLinks = document.getElementById('product-image-links')?.value || '';
    const urlLinks = rawLinks.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (!name || isNaN(price)) {
        showToast('Preencha nome e preço corretamente!', 'error');
        return;
    }

    if (addFormFiles.length === 0 && urlLinks.length === 0) {
        showToast('Adicione pelo menos 1 foto para o produto!', 'error');
        return;
    }

    showToast('Enviando produto e imagens, aguarde...');

    let allUploadedUrls = [];

    try {
        for (const file of addFormFiles) {
            if (typeof file !== 'string') {
                const uploadedUrl = await uploadToImgBB(file);
                allUploadedUrls.push(uploadedUrl);
            } else {
                allUploadedUrls.push(file);
            }
        }

        const allImages = [...allUploadedUrls, ...urlLinks];
        const mainImage = allImages[0];
        const extraImages = allImages.slice(1);

        const newProduct = {
            id: String(Date.now()),
            type,
            name,
            price,
            image: mainImage,
            images: extraImages,
            desc: desc || 'Sem descrição cadastrada'
        };

        await saveProduct(newProduct);
        showToast('Produto adicionado com sucesso!');

        if (document.getElementById('product-name')) document.getElementById('product-name').value = '';
        if (document.getElementById('product-price')) document.getElementById('product-price').value = '';
        if (document.getElementById('product-desc')) document.getElementById('product-desc').value = '';
        if (document.getElementById('product-image-links')) document.getElementById('product-image-links').value = '';
        addFormFiles = [];
        renderFormPreviews('product-gallery-preview', []);

    } catch (e) {
        console.error('Erro ao salvar produto:', e);
        showToast('Erro ao fazer upload das imagens ou salvar online.', 'error');
    }
}

async function saveEditProduct() {
    const id = String(document.getElementById('edit-product-id').value);
    const type = document.getElementById('edit-product-type').value;
    const name = document.getElementById('edit-product-name').value.trim();
    const price = parseFloat(document.getElementById('edit-product-price').value);
    const desc = document.getElementById('edit-product-desc').value.trim();

    const rawLinks = document.getElementById('edit-product-image-links')?.value || '';
    const urlLinks = rawLinks.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (!name || isNaN(price)) {
        showToast('Preencha nome e preço corretamente!', 'error');
        return;
    }

    showToast('Salvando alterações...');

    let allUploadedUrls = [];

    try {
        for (const item of editFormFiles) {
            if (typeof item !== 'string') {
                const url = await uploadToImgBB(item);
                allUploadedUrls.push(url);
            } else {
                allUploadedUrls.push(item);
            }
        }

        const allImages = [...allUploadedUrls, ...urlLinks];
        const mainImage = allImages[0] || 'https://via.placeholder.com/400x400?text=Sem+Imagem';
        const extraImages = allImages.slice(1);

        const updatedProduct = {
            id,
            type,
            name,
            price,
            image: mainImage,
            images: extraImages,
            desc: desc || 'Sem descrição cadastrada'
        };

        await saveProduct(updatedProduct);
        closeEditModal();
        showToast('Produto atualizado com sucesso!');
    } catch (e) {
        console.error('Erro ao salvar edição:', e);
        showToast('Erro ao atualizar o produto.', 'error');
    }
}

// ==================== SALVAMENTO E EXCLUSÃO ====================
async function saveProduct(product) {
    if (firebaseReady) {
        await db.collection('products').doc(String(product.id)).set(product);
    } else {
        const index = products.findIndex(p => String(p.id) === String(product.id));
        if (index !== -1) {
            products[index] = product;
        } else {
            products.push(product);
        }
        saveLocalBackup();
        renderProducts();
        renderAdminProducts();
    }
}

async function deleteProduct(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        const strId = String(id);
        const index = products.findIndex(p => String(p.id) === strId);
        if (index !== -1) {
            lastDeletedProduct = { item: products[index], index: index };
            if (firebaseReady) {
                await db.collection('products').doc(strId).delete();
            } else {
                products.splice(index, 1);
                saveLocalBackup();
                renderProducts();
                renderAdminProducts();
            }
            showToastWithUndo('Produto excluído com sucesso!');
        }
    }
}

async function undoDelete() {
    if (lastDeletedProduct) {
        await saveProduct(lastDeletedProduct.item);
        lastDeletedProduct = null;
        if (undoTimeout) clearTimeout(undoTimeout);
        const toast = document.getElementById('toast');
        if (toast) toast.classList.remove('show');
        showToast('Exclusão desfeita!');
    }
}

function saveLocalBackup() {
    try {
        localStorage.setItem('storeProducts', JSON.stringify(products));
    } catch (e) {
        showToast('Armazenamento do navegador cheio!', 'error');
    }
}

// ==================== PAINEL ADMIN & CONFIGURAÇÕES ====================
function renderAdminProducts() {
    const list = document.getElementById('admin-products-list');
    if (!list) return;

    if (!products.length) {
        list.innerHTML = emptyState();
        return;
    }

    list.innerHTML = products.map(p => `
        <div class="admin-product-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ddd;">
            <img src="${p.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;" onerror="this.src='https://via.placeholder.com/80?text=Sem+Imagem'">
            <div class="admin-product-info" style="flex: 1; margin-left: 15px;">
                <h4 style="margin: 0;">${p.name}</h4>
                <p style="margin: 0; color: #666; font-size: 0.85rem;">${p.type === 'vestido' ? 'Vestido' : 'Tecido'} • R$ ${Number(p.price).toFixed(2)} (${(p.images?.length || 0) + 1} fotos)</p>
            </div>
            <div class="admin-product-actions" style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary btn-small" onclick="openEditModal('${p.id}')">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteProduct('${p.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function openEditModal(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;

    if (document.getElementById('edit-product-id')) document.getElementById('edit-product-id').value = product.id;
    if (document.getElementById('edit-product-type')) document.getElementById('edit-product-type').value = product.type;
    if (document.getElementById('edit-product-name')) document.getElementById('edit-product-name').value = product.name;
    if (document.getElementById('edit-product-price')) document.getElementById('edit-product-price').value = product.price;
    if (document.getElementById('edit-product-desc')) document.getElementById('edit-product-desc').value = product.desc;

    const existingImages = [product.image, ...(product.images || [])].filter(Boolean);
    editFormFiles = [...existingImages];

    renderFormPreviews('edit-product-gallery-preview', editFormFiles);

    const editModal = document.getElementById('edit-modal');
    if (editModal) editModal.classList.add('active');
}

function closeEditModal() {
    const editModal = document.getElementById('edit-modal');
    if (editModal) editModal.classList.remove('active');
}

async function loadConfig() {
    if (firebaseReady) {
        try {
            const doc = await db.collection('config').doc('store').get();
            if (doc.exists) {
                config = doc.data();
            } else {
                await db.collection('config').doc('store').set(config);
            }
        } catch (e) {
            console.error('Erro ao carregar configurações do Firebase:', e);
        }
    } else {
        const savedConfig = localStorage.getItem('storeConfig');
        if (savedConfig) config = JSON.parse(savedConfig);
    }

    if (document.getElementById('whatsapp-number')) {
        document.getElementById('whatsapp-number').value = config.whatsappNumber;
    }
    if (document.getElementById('whatsapp-message')) {
        document.getElementById('whatsapp-message').value = config.whatsappMessage;
    }
}

async function saveConfig() {
    config.whatsappNumber = document.getElementById('whatsapp-number').value.trim();
    config.whatsappMessage = document.getElementById('whatsapp-message').value.trim();

    if (firebaseReady) {
        try {
            await db.collection('config').doc('store').set(config);
        } catch (e) {
            console.error('Erro ao salvar configurações no Firebase:', e);
        }
    }
    localStorage.setItem('storeConfig', JSON.stringify(config));
    showToast('Configurações salvas!');
}

// ==================== MODAL DE COMPRA & UTILITÁRIOS ====================
function openBuyModal(name, price, image) {
    document.getElementById('modal-product-img').src = image;
    document.getElementById('modal-product-title').textContent = name;
    document.getElementById('modal-product-price').textContent = `R$ ${Number(price).toFixed(2)}`;
    
    const confirmBtn = document.getElementById('modal-whatsapp-btn');
    confirmBtn.onclick = () => sendToWhatsApp(name, price);

    document.getElementById('buy-modal').classList.add('active');
}

function closeBuyModal() {
    document.getElementById('buy-modal').classList.remove('active');
}

function sendToWhatsApp(productName, price) {
    const number = config.whatsappNumber.replace(/\D/g, '');
    const message = config.whatsappMessage
        .replace('{produto}', productName)
        .replace('{preco}', Number(price).toFixed(2));

    const url = `https://wa.me/55${number}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    closeBuyModal();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (undoTimeout) clearTimeout(undoTimeout);

    toast.textContent = message;
    toast.style.background = type === 'error' ? '#EF4444' : '#2C1810';
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showToastWithUndo(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (undoTimeout) clearTimeout(undoTimeout);

    toast.style.background = '#2C1810';
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="undoDelete()" class="btn-undo">
            <i class="fas fa-undo"></i> Desfazer
        </button>
    `;
    toast.classList.add('show');

    undoTimeout = setTimeout(() => {
        toast.classList.remove('show');
        lastDeletedProduct = null;
    }, 6000);
}

function showSection(type) {
    const section = document.getElementById(`section-${type}`);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}