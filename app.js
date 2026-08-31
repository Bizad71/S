// ============================================================
// Bizadshop
// Permanent Folder Connection Edition
//
// اطلاعات فروشگاه فقط داخل:
// Bizadshop/bizadshop-data.json
//
// IndexedDB فقط Folder Handle را نگه می‌دارد.
// ============================================================

const DATA_FILE_NAME = "bizadshop-data.json";

const HANDLE_DB_NAME = "BizadshopFolderDB";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_KEY = "main-folder";

let folderHandle = null;

let database = createEmptyDatabase();

let cart = [];


// ============================================================
// BASIC
// ============================================================

function generateId(prefix) {
    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substring(2, 8)
    );
}

function nowISO() {
    return new Date().toISOString();
}

function formatMoney(value) {
    return (
        (Number(value) || 0).toLocaleString("fa-IR") +
        " تومان"
    );
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function setConnectionStatus(text) {
    const element =
        document.getElementById("connectionStatus");

    if (element) {
        element.textContent = text;
    }
}


// ============================================================
// EMPTY DATABASE
// ============================================================

function createEmptyDatabase() {
    return {
        version: 1,
        products: [],
        inventory: {},
        sales: [],
        sale_items: [],
        settings: {}
    };
}


// ============================================================
// HANDLE DATABASE
// ============================================================

function openHandleDB() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(
            HANDLE_DB_NAME,
            HANDLE_DB_VERSION
        );

        request.onupgradeneeded = function (event) {

            const db = event.target.result;

            if (!db.objectStoreNames.contains(HANDLE_STORE)) {
                db.createObjectStore(HANDLE_STORE);
            }
        };

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}


async function saveFolderHandle(handle) {

    const db = await openHandleDB();

    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            HANDLE_STORE,
            "readwrite"
        );

        tx.objectStore(HANDLE_STORE).put(
            handle,
            HANDLE_KEY
        );

        tx.oncomplete = () => {
            db.close();
            resolve();
        };

        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}


async function getFolderHandle() {

    const db = await openHandleDB();

    return new Promise((resolve, reject) => {

        const tx = db.transaction(
            HANDLE_STORE,
            "readonly"
        );

        const request =
            tx.objectStore(HANDLE_STORE).get(
                HANDLE_KEY
            );

        request.onsuccess = () => {
            db.close();

            resolve(
                request.result || null
            );
        };

        request.onerror = () => {
            db.close();

            reject(request.error);
        };
    });
}


// ============================================================
// PERMISSION
// ============================================================

async function getFolderPermission(handle) {

    if (!handle) {
        return "denied";
    }

    try {

        return await handle.queryPermission({
            mode: "readwrite"
        });

    } catch (error) {

        console.error(error);

        return "denied";
    }
}


async function requestFolderPermission(handle) {

    if (!handle) {
        return false;
    }

    try {

        let permission =
            await getFolderPermission(handle);

        if (permission === "granted") {
            return true;
        }

        permission =
            await handle.requestPermission({
                mode: "readwrite"
            });

        return permission === "granted";

    } catch (error) {

        console.error(error);

        return false;
    }
}


// ============================================================
// FIND DATA FILE
// ============================================================

async function getDataFileHandle() {

    if (!folderHandle) {
        throw new Error("پوشه متصل نیست.");
    }

    try {

        return await folderHandle.getFileHandle(
            DATA_FILE_NAME
        );

    } catch (error) {

        if (error.name === "NotFoundError") {
            return null;
        }

        throw error;
    }
}


// ============================================================
// CREATE DATA FILE ONLY IF IT DOES NOT EXIST
// ============================================================

async function ensureDataFile() {

    if (!folderHandle) {
        throw new Error("پوشه متصل نیست.");
    }

    let fileHandle =
        await getDataFileHandle();

    // فایل وجود دارد:
    // به هیچ وجه روی آن چیزی نمی‌نویسیم.
    if (fileHandle) {
        return fileHandle;
    }

    // فقط اگر فایل واقعاً وجود نداشت،
    // فایل جدید ساخته می‌شود.
    fileHandle =
        await folderHandle.getFileHandle(
            DATA_FILE_NAME,
            {
                create: true
            }
        );

    const writable =
        await fileHandle.createWritable();

    await writable.write(
        JSON.stringify(
            createEmptyDatabase(),
            null,
            2
        )
    );

    await writable.close();

    return fileHandle;
}


// ============================================================
// LOAD DATA FROM FILE
// ============================================================

async function loadDataFromFolder() {

    if (!folderHandle) {
        throw new Error("پوشه متصل نیست.");
    }

    // اول فایل موجود را پیدا می‌کنیم.
    let fileHandle =
        await getDataFileHandle();

    // اگر وجود ندارد، تازه می‌سازیم.
    if (!fileHandle) {
        fileHandle =
            await ensureDataFile();
    }

    const file =
        await fileHandle.getFile();

    const text =
        await file.text();

    // فایل خالی است.
    if (!text.trim()) {

        database =
            createEmptyDatabase();

        await saveDataToFolder();

        return;
    }

    let parsed;

    try {

        parsed =
            JSON.parse(text);

    } catch (error) {

        throw new Error(
            "فایل bizadshop-data.json خراب یا نامعتبر است."
        );
    }

    // اطلاعات واقعی فایل را وارد برنامه می‌کنیم.
    database = {

        version:
            parsed.version || 1,

        products:
            Array.isArray(parsed.products)
                ? parsed.products
                : [],

        inventory:
            parsed.inventory &&
            typeof parsed.inventory === "object"
                ? parsed.inventory
                : {},

        sales:
            Array.isArray(parsed.sales)
                ? parsed.sales
                : [],

        sale_items:
            Array.isArray(parsed.sale_items)
                ? parsed.sale_items
                : [],

        settings:
            parsed.settings &&
            typeof parsed.settings === "object"
                ? parsed.settings
                : {}
    };
}


// ============================================================
// SAVE DATA
// ============================================================

async function saveDataToFolder() {

    if (!folderHandle) {
        throw new Error(
            "پوشه Bizadshop متصل نیست."
        );
    }

    const permission =
        await getFolderPermission(
            folderHandle
        );

    if (permission !== "granted") {
        throw new Error(
            "دسترسی نوشتن به پوشه وجود ندارد."
        );
    }

    const fileHandle =
        await folderHandle.getFileHandle(
            DATA_FILE_NAME,
            {
                create: true
            }
        );

    const writable =
        await fileHandle.createWritable();

    await writable.write(
        JSON.stringify(
            database,
            null,
            2
        )
    );

    await writable.close();
}


async function saveDatabase() {

    try {

        await saveDataToFolder();

        return true;

    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "ذخیره اطلاعات ناموفق بود."
        );

        return false;
    }
}


// ============================================================
// CONNECT EXISTING FOLDER
// ============================================================

async function connectExistingFolder() {

    const handle =
        await getFolderHandle();

    if (!handle) {
        return false;
    }

    folderHandle = handle;

    const permission =
        await getFolderPermission(
            folderHandle
        );

    if (permission !== "granted") {

        folderHandle = null;

        setConnectionStatus(
            "نیاز به تأیید دسترسی پوشه"
        );

        return false;
    }

    // ========================================================
    // خیلی مهم:
    // اول اطلاعات فایل قبلی خوانده می‌شود.
    // دیتابیس خالی ساخته نمی‌شود.
    // ========================================================

    await loadDataFromFolder();

    setConnectionStatus(
        "متصل به پوشه: " +
        handle.name
    );

    await refreshAll();

    return true;
}


// ============================================================
// CHOOSE NEW FOLDER
// ============================================================

async function chooseFolder() {

    if (!("showDirectoryPicker" in window)) {

        showToast(
            "این مرورگر از اتصال مستقیم به پوشه پشتیبانی نمی‌کند."
        );

        return false;
    }

    try {

        const handle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });

        const permission =
            await requestFolderPermission(
                handle
            );

        if (!permission) {

            showToast(
                "اجازه دسترسی به پوشه داده نشد."
            );

            return false;
        }

        folderHandle =
            handle;

        // Handle را ذخیره می‌کنیم
        // تا دفعه بعد دوباره انتخاب نشود.
        await saveFolderHandle(
            folderHandle
        );

        // اطلاعات قبلی را می‌خوانیم.
        await loadDataFromFolder();

        setConnectionStatus(
            "متصل به پوشه: " +
            folderHandle.name
        );

        await refreshAll();

        showToast(
            "پوشه متصل شد و اطلاعات قبلی بازیابی شد."
        );

        return true;

    } catch (error) {

        console.error(error);

        if (error.name !== "AbortError") {

            showToast(
                error.message ||
                "اتصال پوشه ناموفق بود."
            );
        }

        return false;
    }
}


// ============================================================
// PRODUCTS
// ============================================================

async function getProducts() {
    return database.products;
}


async function getProduct(id) {

    return database.products.find(
        product =>
            product.id === id
    );
}


async function getProductByBarcode(barcode) {

    return database.products.find(
        product =>
            String(product.barcode).trim() ===
            String(barcode).trim()
    );
}


// ============================================================
// INVENTORY
// ============================================================

async function getQuantity(productId) {

    return Number(
        database.inventory[productId]?.quantity
    ) || 0;
}


async function setQuantity(
    productId,
    quantity
) {

    database.inventory[productId] = {

        productId:
            productId,

        quantity:
            Number(quantity) || 0,

        updatedAt:
            nowISO()
    };
}


// ============================================================
// SAVE PRODUCT
// ============================================================

async function saveProduct(product) {

    const existing =
        await getProductByBarcode(
            product.barcode
        );

    if (
        existing &&
        existing.id !== product.id
    ) {

        throw new Error(
            "این بارکد قبلاً ثبت شده است."
        );
    }

    const index =
        database.products.findIndex(
            item =>
                item.id === product.id
        );

    if (index >= 0) {

        database.products[index] =
            product;

    } else {

        database.products.push(
            product
        );
    }

    if (
        !database.inventory[product.id]
    ) {

        await setQuantity(
            product.id,
            product.initialQuantity
        );
    }

    await saveDatabase();

    return product;
}


// ============================================================
// PRODUCT FORM
// ============================================================

document
    .getElementById("productForm")
    .addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            try {

                const id =
                    document
                        .getElementById(
                            "productId"
                        )
                        .value;

                const barcode =
                    document
                        .getElementById(
                            "productBarcode"
                        )
                        .value
                        .trim();

                const name =
                    document
                        .getElementById(
                            "productName"
                        )
                        .value
                        .trim();

                const category =
                    document
                        .getElementById(
                            "productCategory"
                        )
                        .value
                        .trim();

                const purchasePrice =
                    Number(
                        document
                            .getElementById(
                                "purchasePrice"
                            )
                            .value
                    ) || 0;

                const salePrice =
                    Number(
                        document
                            .getElementById(
                                "salePrice"
                            )
                            .value
                    ) || 0;

                const unit =
                    document
                        .getElementById(
                            "productUnit"
                        )
                        .value;

                const initialQuantity =
                    Number(
                        document
                            .getElementById(
                                "initialQuantity"
                            )
                            .value
                    ) || 0;

                if (!barcode) {
                    throw new Error(
                        "بارکد را وارد کنید."
                    );
                }

                if (!name) {
                    throw new Error(
                        "نام کالا را وارد کنید."
                    );
                }

                let product;

                if (id) {

                    product =
                        await getProduct(id);

                    if (!product) {
                        throw new Error(
                            "کالا پیدا نشد."
                        );
                    }

                    product.barcode =
                        barcode;

                    product.name =
                        name;

                    product.category =
                        category;

                    product.purchasePrice =
                        purchasePrice;

                    product.salePrice =
                        salePrice;

                    product.unit =
                        unit;

                    product.updatedAt =
                        nowISO();

                } else {

                    product = {

                        id:
                            generateId(
                                "product"
                            ),

                        barcode:
                            barcode,

                        name:
                            name,

                        category:
                            category,

                        purchasePrice:
                            purchasePrice,

                        salePrice:
                            salePrice,

                        unit:
                            unit,

                        createdAt:
                            nowISO(),

                        updatedAt:
                            nowISO(),

                        initialQuantity:
                            initialQuantity
                    };
                }

                await saveProduct(
                    product
                );

                closeModal(
                    "productModal"
                );

                event.target.reset();

                document
                    .getElementById(
                        "productId"
                    )
                    .value = "";

                document
                    .getElementById(
                        "initialQuantity"
                    )
                    .value = "0";

                await refreshAll();

                showToast(
                    id
                        ? "کالا ویرایش شد."
                        : "کالا با موفقیت ذخیره شد."
                );

            } catch (error) {

                showToast(
                    error.message ||
                    "ذخیره کالا ناموفق بود."
                );
            }
        }
    );


// ============================================================
// EDIT PRODUCT
// ============================================================

async function editProduct(productId) {

    const product =
        await getProduct(productId);

    if (!product) {

        showToast(
            "کالا پیدا نشد."
        );

        return;
    }

    document
        .getElementById(
            "productModalTitle"
        )
        .textContent =
            "ویرایش کالا";

    document
        .getElementById(
            "productId"
        )
        .value =
            product.id;

    document
        .getElementById(
            "productBarcode"
        )
        .value =
            product.barcode;

    document
        .getElementById(
            "productName"
        )
        .value =
            product.name;

    document
        .getElementById(
            "productCategory"
        )
        .value =
            product.category || "";

    document
        .getElementById(
            "purchasePrice"
        )
        .value =
            product.purchasePrice || 0;

    document
        .getElementById(
            "salePrice"
        )
        .value =
            product.salePrice || 0;

    document
        .getElementById(
            "productUnit"
        )
        .value =
            product.unit || "عدد";

    document
        .getElementById(
            "initialQuantity"
        )
        .value =
            0;

    openModal(
        "productModal"
    );
}


// ============================================================
// DELETE PRODUCT
// ============================================================

async function deleteProduct(productId) {

    const product =
        await getProduct(productId);

    if (!product) return;

    if (
        !confirm(
            `کالای «${product.name}» حذف شود؟`
        )
    ) {
        return;
    }

    database.products =
        database.products.filter(
            item =>
                item.id !== productId
        );

    delete database.inventory[
        productId
    ];

    cart =
        cart.filter(
            item =>
                item.productId !==
                productId
        );

    await saveDatabase();

    await refreshAll();

    showToast(
        "کالا حذف شد."
    );
}


// ============================================================
// PRODUCTS LIST
// ============================================================

async function renderProducts(search = "") {

    const container =
        document.getElementById(
            "productsList"
        );

    let products =
        await getProducts();

    const text =
        search.trim().toLowerCase();

    if (text) {

        products =
            products.filter(
                product =>
                    product.name
                        .toLowerCase()
                        .includes(text)
                    ||
                    String(product.barcode)
                        .toLowerCase()
                        .includes(text)
                    ||
                    String(
                        product.category || ""
                    )
                        .toLowerCase()
                        .includes(text)
            );
    }

    products.sort(
        (a, b) =>
            String(b.createdAt)
                .localeCompare(
                    String(a.createdAt)
                )
    );

    if (!products.length) {

        container.innerHTML =
            `<div class="empty">
                کالایی پیدا نشد.
            </div>`;

        return;
    }

    let html = "";

    for (const product of products) {

        const quantity =
            await getQuantity(
                product.id
            );

        let stockClass = "good";

        if (quantity <= 0) {
            stockClass = "empty";
        } else if (quantity <= 5) {
            stockClass = "low";
        }

        html += `

        <div class="product-card">

            <div class="product-main">

                <div class="product-info">

                    <div class="product-name">
                        ${escapeHTML(product.name)}
                    </div>

                    <div class="product-barcode">
                        ${escapeHTML(product.barcode)}
                    </div>

                </div>

                <div class="product-price">

                    <small>
                        قیمت فروش
                    </small>

                    <strong>
                        ${formatMoney(product.salePrice)}
                    </strong>

                </div>

            </div>

            <div class="product-bottom">

                <div class="stock ${stockClass}">
                    موجودی:
                    ${quantity.toLocaleString("fa-IR")}
                    ${escapeHTML(product.unit || "عدد")}
                </div>

                <div class="product-actions">

                    <button
                        class="small-button"
                        onclick="openStockModal('${product.id}')"
                        type="button"
                    >
                        موجودی
                    </button>

                    <button
                        class="small-button"
                        onclick="editProduct('${product.id}')"
                        type="button"
                    >
                        ویرایش
                    </button>

                    <button
                        class="small-button danger"
                        onclick="deleteProduct('${product.id}')"
                        type="button"
                    >
                        حذف
                    </button>

                </div>

            </div>

        </div>
        `;
    }

    container.innerHTML = html;
}


// ============================================================
// INVENTORY
// ============================================================

async function renderInventory(search = "") {

    const container =
        document.getElementById(
            "inventoryList"
        );

    let products =
        await getProducts();

    const text =
        search.trim().toLowerCase();

    if (text) {

        products =
            products.filter(
                product =>
                    product.name
                        .toLowerCase()
                        .includes(text)
                    ||
                    String(product.barcode)
                        .toLowerCase()
                        .includes(text)
            );
    }

    if (!products.length) {

        container.innerHTML =
            `<div class="empty">
                موجودی خالی است.
            </div>`;

        return;
    }

    let html = "";

    for (const product of products) {

        const quantity =
            await getQuantity(
                product.id
            );

        let stockClass = "good";

        if (quantity <= 0) {
            stockClass = "empty";
        } else if (quantity <= 5) {
            stockClass = "low";
        }

        html += `

        <div class="product-card">

            <div class="product-main">

                <div class="product-info">

                    <div class="product-name">
                        ${escapeHTML(product.name)}
                    </div>

                    <div class="product-barcode">
                        ${escapeHTML(product.barcode)}
                    </div>

                </div>

                <div class="stock ${stockClass}">
                    ${quantity.toLocaleString("fa-IR")}
                    ${escapeHTML(product.unit || "عدد")}
                </div>

            </div>

            <div class="product-bottom">

                <span>
                    قیمت فروش:
                    ${formatMoney(product.salePrice)}
                </span>

                <button
                    class="small-button"
                    onclick="openStockModal('${product.id}')"
                    type="button"
                >
                    تغییر موجودی
                </button>

            </div>

        </div>
        `;
    }

    container.innerHTML = html;
}


// ============================================================
// STOCK MODAL
// ============================================================

async function openStockModal(productId) {

    const product =
        await getProduct(productId);

    if (!product) return;

    const quantity =
        await getQuantity(productId);

    document
        .getElementById(
            "stockProductId"
        )
        .value =
            productId;

    document
        .getElementById(
            "stockProductName"
        )
        .textContent =
            `${product.name} — موجودی فعلی: ${quantity}`;

    document
        .getElementById(
            "stockAmount"
        )
        .value = "";

    document
        .getElementById(
            "stockAction"
        )
        .value =
            "increase";

    openModal(
        "stockModal"
    );
}


// ============================================================
// STOCK FORM
// ============================================================

document
    .getElementById("stockForm")
    .addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            try {

                const productId =
                    document
                        .getElementById(
                            "stockProductId"
                        )
                        .value;

                const action =
                    document
                        .getElementById(
                            "stockAction"
                        )
                        .value;

                const amount =
                    Number(
                        document
                            .getElementById(
                                "stockAmount"
                            )
                            .value
                    );

                if (
                    !Number.isFinite(amount) ||
                    amount < 0
                ) {
                    throw new Error(
                        "مقدار نامعتبر است."
                    );
                }

                const current =
                    await getQuantity(
                        productId
                    );

                let newQuantity;

                if (
                    action === "increase"
                ) {

                    newQuantity =
                        current + amount;

                } else if (
                    action === "decrease"
                ) {

                    if (amount > current) {
                        throw new Error(
                            "موجودی کافی نیست."
                        );
                    }

                    newQuantity =
                        current - amount;

                } else {

                    newQuantity =
                        amount;
                }

                await setQuantity(
                    productId,
                    newQuantity
                );

                await saveDatabase();

                closeModal(
                    "stockModal"
                );

                await refreshAll();

                showToast(
                    "موجودی ذخیره شد."
                );

            } catch (error) {

                showToast(
                    error.message
                );
            }
        }
    );


// ============================================================
// CART
// ============================================================

async function addToCart(productId) {

    const product =
        await getProduct(productId);

    if (!product) return;

    const quantity =
        await getQuantity(productId);

    if (quantity <= 0) {

        showToast(
            "این کالا موجود نیست."
        );

        return;
    }

    const existing =
        cart.find(
            item =>
                item.productId ===
                productId
        );

    if (existing) {

        if (
            existing.quantity >=
            quantity
        ) {

            showToast(
                "موجودی کافی نیست."
            );

            return;
        }

        existing.quantity++;

    } else {

        cart.push({
            productId:
                productId,

            quantity:
                1
        });
    }

    renderCart();
}


function removeFromCart(productId) {

    cart =
        cart.filter(
            item =>
                item.productId !==
                productId
        );

    renderCart();
}


async function changeCartQuantity(
    productId,
    change
) {

    const item =
        cart.find(
            item =>
                item.productId ===
                productId
        );

    if (!item) return;

    const stock =
        await getQuantity(
            productId
        );

    const newQuantity =
        item.quantity + change;

    if (newQuantity <= 0) {

        removeFromCart(
            productId
        );

        return;
    }

    if (newQuantity > stock) {

        showToast(
            "موجودی کافی نیست."
        );

        return;
    }

    item.quantity =
        newQuantity;

    renderCart();
}


async function renderCart() {

    const container =
        document.getElementById(
            "cartList"
        );

    if (!cart.length) {

        container.innerHTML =
            `<div class="empty">
                سبد فروش خالی است.
            </div>`;

        document
            .getElementById(
                "cartTotal"
            )
            .textContent =
                "0 تومان";

        return;
    }

    let html = "";
    let total = 0;

    for (const item of cart) {

        const product =
            await getProduct(
                item.productId
            );

        if (!product) continue;

        const itemTotal =
            Number(product.salePrice) *
            item.quantity;

        total += itemTotal;

        html += `

        <div class="cart-item">

            <div class="cart-info">

                <strong>
                    ${escapeHTML(product.name)}
                </strong>

                <small>
                    ${formatMoney(product.salePrice)}
                    ×
                    ${item.quantity.toLocaleString("fa-IR")}
                </small>

            </div>

            <div class="cart-controls">

                <button
                    class="quantity-button"
                    onclick="changeCartQuantity('${product.id}', 1)"
                    type="button"
                >
                    +
                </button>

                <strong>
                    ${item.quantity.toLocaleString("fa-IR")}
                </strong>

                <button
                    class="quantity-button"
                    onclick="changeCartQuantity('${product.id}', -1)"
                    type="button"
                >
                    −
                </button>

            </div>

        </div>
        `;
    }

    container.innerHTML =
        html;

    document
        .getElementById(
            "cartTotal"
        )
        .textContent =
            formatMoney(total);
}


// ============================================================
// CHECKOUT
// ============================================================

async function checkout() {

    if (!cart.length) {

        showToast(
            "سبد فروش خالی است."
        );

        return;
    }

    const saleId =
        generateId("sale");

    const createdAt =
        nowISO();

    let total = 0;

    const saleItems = [];

    for (const item of cart) {

        const product =
            await getProduct(
                item.productId
            );

        if (!product) {

            throw new Error(
                "یکی از کالاها پیدا نشد."
            );
        }

        const stock =
            await getQuantity(
                item.productId
            );

        if (
            item.quantity >
            stock
        ) {

            throw new Error(
                `موجودی «${product.name}» کافی نیست.`
            );
        }

        const itemTotal =
            Number(product.salePrice) *
            item.quantity;

        total += itemTotal;

        saleItems.push({

            id:
                generateId(
                    "saleitem"
                ),

            saleId:
                saleId,

            productId:
                product.id,

            quantity:
                item.quantity,

            unitPrice:
                Number(product.salePrice),

            totalPrice:
                itemTotal
        });
    }

    database.sales.push({

        id:
            saleId,

        totalAmount:
            total,

        discount:
            0,

        finalAmount:
            total,

        createdAt:
            createdAt
    });

    for (const item of saleItems) {

        database.sale_items.push(
            item
        );

        const current =
            await getQuantity(
                item.productId
            );

        await setQuantity(
            item.productId,
            current - item.quantity
        );
    }

    const saved =
        await saveDatabase();

    if (!saved) return;

    cart = [];

    await refreshAll();

    showToast(
        "فروش با موفقیت در پوشه ذخیره شد."
    );
}


// ============================================================
// TODAY SALES
// ============================================================

function isToday(isoDate) {

    const date =
        new Date(isoDate);

    const now =
        new Date();

    return (
        date.getFullYear() ===
            now.getFullYear()
        &&
        date.getMonth() ===
            now.getMonth()
        &&
        date.getDate() ===
            now.getDate()
    );
}


async function getTodaySales() {

    return database.sales.filter(
        sale =>
            isToday(
                sale.createdAt
            )
    );
}


// ============================================================
// DASHBOARD
// ============================================================

async function renderDashboard() {

    const products =
        await getProducts();

    let totalStock = 0;

    for (const product of products) {

        totalStock +=
            await getQuantity(
                product.id
            );
    }

    const sales =
        await getTodaySales();

    const salesAmount =
        sales.reduce(
            (
                sum,
                sale
            ) =>
                sum +
                (
                    Number(
                        sale.finalAmount
                    ) || 0
                ),
            0
        );

    document
        .getElementById(
            "totalProducts"
        )
        .textContent =
            products.length.toLocaleString(
                "fa-IR"
            );

    document
        .getElementById(
            "totalStock"
        )
        .textContent =
            totalStock.toLocaleString(
                "fa-IR"
            );

    document
        .getElementById(
            "todaySales"
        )
        .textContent =
            sales.length.toLocaleString(
                "fa-IR"
            );

    document
        .getElementById(
            "todaySalesAmount"
        )
        .textContent =
            formatMoney(
                salesAmount
            );

    await renderLowStock();
}


// ============================================================
// LOW STOCK
// ============================================================

async function renderLowStock() {

    const container =
        document.getElementById(
            "lowStockList"
        );

    const products =
        await getProducts();

    const lowStock = [];

    for (const product of products) {

        const quantity =
            await getQuantity(
                product.id
            );

        if (quantity <= 5) {

            lowStock.push({
                product:
                    product,

                quantity:
                    quantity
            });
        }
    }

    if (!lowStock.length) {

        container.innerHTML =
            `<div class="empty">
                همه کالاها موجودی مناسبی دارند.
            </div>`;

        return;
    }

    let html = "";

    for (
        const item of lowStock.slice(0, 5)
    ) {

        html += `

        <div class="product-card">

            <div class="product-main">

                <div class="product-info">

                    <div class="product-name">
                        ${escapeHTML(
                            item.product.name
                        )}
                    </div>

                    <div class="product-barcode">
                        ${escapeHTML(
                            item.product.barcode
                        )}
                    </div>

                </div>

                <div class="stock ${
                    item.quantity <= 0
                        ? "empty"
                        : "low"
                }">

                    موجودی:
                    ${item.quantity.toLocaleString(
                        "fa-IR"
                    )}

                </div>

            </div>

        </div>
        `;
    }

    container.innerHTML =
        html;
}


// ============================================================
// INVENTORY SUMMARY
// ============================================================

async function renderInventorySummary() {

    const products =
        await getProducts();

    let total = 0;

    for (const product of products) {

        total +=
            await getQuantity(
                product.id
            );
    }

    document
        .getElementById(
            "inventoryProductCount"
        )
        .textContent =
            products.length.toLocaleString(
                "fa-IR"
            );

    document
        .getElementById(
            "inventoryTotalStock"
        )
        .textContent =
            total.toLocaleString(
                "fa-IR"
            );
}


// ============================================================
// SALE SEARCH
// ============================================================

async function renderSaleSearch(text) {

    const container =
        document.getElementById(
            "saleSearchResults"
        );

    text =
        String(text || "")
            .trim()
            .toLowerCase();

    if (!text) {

        container.innerHTML = "";

        return;
    }

    const products =
        await getProducts();

    const results =
        products
            .filter(
                product =>
                    product.name
                        .toLowerCase()
                        .includes(text)
                    ||
                    String(
                        product.barcode
                    )
                        .toLowerCase()
                        .includes(text)
            )
            .slice(0, 10);

    if (!results.length) {

        container.innerHTML =
            `<div class="empty">
                کالایی پیدا نشد.
            </div>`;

        return;
    }

    let html = "";

    for (const product of results) {

        const quantity =
            await getQuantity(
                product.id
            );

        html += `

        <div class="sale-result">

            <div class="sale-result-info">

                <strong>
                    ${escapeHTML(
                        product.name
                    )}
                </strong>

                <small>
                    ${escapeHTML(
                        product.barcode
                    )}
                    · موجودی:
                    ${quantity.toLocaleString(
                        "fa-IR"
                    )}
                    ·
                    ${formatMoney(
                        product.salePrice
                    )}
                </small>

            </div>

            <button
                class="small-button"
                onclick="addToCart('${product.id}')"
                type="button"
            >
                افزودن
            </button>

        </div>
        `;
    }

    container.innerHTML =
        html;
}


// ============================================================
// NAVIGATION
// ============================================================

function showPage(pageName) {

    document
        .querySelectorAll(".page")
        .forEach(
            page =>
                page.classList.remove(
                    "active"
                )
        );

    const page =
        document.getElementById(
            pageName + "Page"
        );

    if (page) {

        page.classList.add(
            "active"
        );
    }

    document
        .querySelectorAll(".nav-btn")
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page ===
                        pageName
                );
            }
        );
}


// ============================================================
// MODALS
// ============================================================

function openModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {
        modal.classList.add("show");
    }
}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {
        modal.classList.remove("show");
    }
}


document
    .querySelectorAll("[data-close-modal]")
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.closeModal
                    );
                }
            );
        }
    );


document
    .querySelectorAll(".modal")
    .forEach(
        modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList.remove(
                            "show"
                        );
                    }
                }
            );
        }
    );


// ============================================================
// ADD PRODUCT
// ============================================================

function openAddProductModal() {

    document
        .getElementById(
            "productModalTitle"
        )
        .textContent =
            "افزودن کالا";

    document
        .getElementById(
            "productForm"
        )
        .reset();

    document
        .getElementById(
            "productId"
        )
        .value = "";

    document
        .getElementById(
            "initialQuantity"
        )
        .value = "0";

    openModal(
        "productModal"
    );
}


// ============================================================
// EVENT LISTENERS
// ============================================================

document
    .querySelectorAll(".nav-btn")
    .forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    const page =
                        button.dataset.page;

                    showPage(page);

                    if (
                        page === "products"
                    ) {
                        await renderProducts();
                    }

                    if (
                        page === "inventory"
                    ) {
                        await renderInventory();
                        await renderInventorySummary();
                    }

                    if (
                        page === "sale"
                    ) {
                        await renderCart();
                    }
                }
            );
        }
    );


document
    .getElementById(
        "settingsBtn"
    )
    .addEventListener(
        "click",
        async () => {

            await chooseFolder();

        }
    );


document
    .getElementById(
        "addProductBtn"
    )
    .addEventListener(
        "click",
        openAddProductModal
    );


document
    .getElementById(
        "quickAddProduct"
    )
    .addEventListener(
        "click",
        () => {

            showPage("products");

            openAddProductModal();

        }
    );


document
    .getElementById(
        "quickSale"
    )
    .addEventListener(
        "click",
        () => {

            showPage("sale");

            renderCart();

        }
    );


document
    .getElementById(
        "productSearch"
    )
    .addEventListener(
        "input",
        event => {

            renderProducts(
                event.target.value
            );

        }
    );


document
    .getElementById(
        "inventorySearch"
    )
    .addEventListener(
        "input",
        event => {

            renderInventory(
                event.target.value
            );

        }
    );


document
    .getElementById(
        "saleSearch"
    )
    .addEventListener(
        "input",
        event => {

            renderSaleSearch(
                event.target.value
            );

        }
    );


document
    .getElementById(
        "clearCartBtn"
    )
    .addEventListener(
        "click",
        () => {

            cart = [];

            renderCart();

        }
    );


document
    .getElementById(
        "checkoutBtn"
    )
    .addEventListener(
        "click",
        async () => {

            try {

                await checkout();

            } catch (error) {

                showToast(
                    error.message ||
                    "ثبت فروش ناموفق بود."
                );
            }
        }
    );


document
    .getElementById(
        "showLowStock"
    )
    .addEventListener(
        "click",
        () => {

            showPage(
                "inventory"
            );

            renderInventory();

            renderInventorySummary();

        }
    );


document
    .getElementById(
        "productBarcode"
    )
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                document
                    .getElementById(
                        "productName"
                    )
                    .focus();
            }
        }
    );


document
    .getElementById(
        "scanBarcodeBtn"
    )
    .addEventListener(
        "click",
        () => {

            showToast(
                "اسکنر بارکد را در مرحله بعد فعال می‌کنیم."
            );

        }
    );


// ============================================================
// REFRESH
// ============================================================

async function refreshAll() {

    await renderDashboard();

    await renderProducts(
        document
            .getElementById(
                "productSearch"
            )
            .value
    );

    await renderInventory(
        document
            .getElementById(
                "inventorySearch"
            )
            .value
    );

    await renderInventorySummary();

    await renderCart();
}


// ============================================================
// INITIALIZE
// ============================================================

async function initApp() {

    if (
        !("showDirectoryPicker" in window)
    ) {

        setConnectionStatus(
            "مرورگر از اتصال پوشه پشتیبانی نمی‌کند"
        );

        showToast(
            "برای این قابلیت از Chrome یا مرورگر سازگار استفاده کنید."
        );

        return;
    }

    setConnectionStatus(
        "در حال بازیابی اطلاعات..."
    );

    try {

        // ====================================================
        // مهم:
        // اول Handle قبلی را پیدا می‌کنیم.
        // ====================================================

        const handle =
            await getFolderHandle();

        if (handle) {

            folderHandle =
                handle;

            const permission =
                await getFolderPermission(
                    folderHandle
                );

            if (
                permission === "granted"
            ) {

                // =================================================
                // اینجا اطلاعات فایل قبلی خوانده می‌شود.
                // =================================================

                await loadDataFromFolder();

                setConnectionStatus(
                    "متصل به پوشه: " +
                    folderHandle.name
                );

                await refreshAll();

                console.log(
                    "Bizadshop: اطلاعات قبلی بازیابی شد."
                );

                return;
            }
        }

        // ========================================================
        // اگر Handle وجود ندارد یا مجوز واقعاً از بین رفته:
        // دیتابیس را صفر نمی‌کنیم.
        // ========================================================

        setConnectionStatus(
            "برای اتصال اولیه پوشه را انتخاب کنید"
        );

        // اطلاعات خالی فقط در حافظه است.
        // روی فایل قبلی چیزی نوشته نمی‌شود.
        database =
            createEmptyDatabase();

        await refreshAll();

    } catch (error) {

        console.error(
            "Bizadshop initialization error:",
            error
        );

        // ========================================================
        // خیلی مهم:
        // در صورت خطای اتصال، اطلاعات موجود را با صفر
        // جایگزین نمی‌کنیم.
        // ========================================================

        setConnectionStatus(
            "اتصال پوشه نیاز به تأیید دارد"
        );

        showToast(
            "اتصال خودکار به پوشه انجام نشد. از ⚙️ پوشه را دوباره انتخاب کنید."
        );
    }
}


// ============================================================
// START
// ============================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initApp
    );

} else {

    initApp();
}

