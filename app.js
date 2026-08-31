// ============================================================
// Bizadshop
// File-Based Local Storage
// Products + Inventory + Sales
//
// اطلاعات اصلی داخل پوشه Bizadshop ذخیره می‌شود.
//
// ساختار:
//
// Bizadshop/
// ├── products.json
// ├── inventory.json
// ├── sales.json
// ├── sale_items.json
// ├── shop.json
// └── settings.json
//
// IndexedDB در این نسخه محل اطلاعات عملیاتی نیست.
// ============================================================


const APP_FOLDER_NAME = "Bizadshop";

const FILES = {
    products: "products.json",
    inventory: "inventory.json",
    sales: "sales.json",
    saleItems: "sale_items.json",
    shop: "shop.json",
    settings: "settings.json"
};


let rootDirectory = null;

let data = {
    products: [],
    inventory: [],
    sales: [],
    saleItems: [],
    shop: {},
    settings: {}
};

let cart = [];

let isReady = false;


// ============================================================
// UTILITY
// ============================================================

function generateId(prefix) {

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}


function nowISO() {

    return new Date()
        .toISOString();
}


function formatMoney(value) {

    return (
        Number(value) || 0
    ).toLocaleString(
        "fa-IR"
    ) + " تومان";
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

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 2500);
}


function isToday(isoDate) {

    const date =
        new Date(
            isoDate
        );

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


// ============================================================
// FILE SYSTEM SUPPORT
// ============================================================

function isFileSystemSupported() {

    return (
        "showDirectoryPicker" in window
    );
}


function ensureStorageAvailable() {

    if (!isFileSystemSupported()) {

        throw new Error(
            "این مرورگر از دسترسی مستقیم به پوشه‌های حافظه پشتیبانی نمی‌کند."
        );
    }
}


// ============================================================
// DIRECTORY ACCESS
// ============================================================

async function chooseStorageFolder() {

    try {

        ensureStorageAvailable();


        /*
         * کاربر یک پوشه مادر را انتخاب می‌کند.
         *
         * سپس Bizadshop داخل همان پوشه ساخته می‌شود.
         *
         * مثال:
         *
         * حافظه داخلی
         *      ↓
         * انتخاب
         *      ↓
         * Bizadshop/
         */

        const parentDirectory =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });


        rootDirectory =
            await parentDirectory.getDirectoryHandle(
                APP_FOLDER_NAME,
                {
                    create: true
                }
            );


        await createRequiredFiles();


        await loadAllData();


        isReady = true;


        updateStorageStatus();


        await refreshAll();


        showToast(
            "پوشه Bizadshop آماده شد."
        );


    } catch (error) {

        console.error(
            "Storage error:",
            error
        );


        if (
            error &&
            error.name ===
                "AbortError"
        ) {

            showToast(
                "انتخاب پوشه لغو شد."
            );

            return;
        }


        showStorageError(
            error.message ||
            "اتصال به پوشه ناموفق بود."
        );
    }
}


// ============================================================
// FILE HELPERS
// ============================================================

async function getFileHandle(
    fileName,
    create = true
) {

    if (!rootDirectory) {

        throw new Error(
            "پوشه Bizadshop متصل نیست."
        );
    }


    return await rootDirectory.getFileHandle(
        fileName,
        {
            create: create
        }
    );
}


async function fileExists(
    fileName
) {

    if (!rootDirectory) {
        return false;
    }


    try {

        await rootDirectory.getFileHandle(
            fileName
        );

        return true;

    } catch {

        return false;
    }
}


async function readJSON(
    fileName,
    defaultValue
) {

    const exists =
        await fileExists(
            fileName
        );


    if (!exists) {

        return defaultValue;
    }


    const fileHandle =
        await getFileHandle(
            fileName,
            false
        );


    const file =
        await fileHandle.getFile();


    const text =
        await file.text();


    if (!text.trim()) {

        return defaultValue;
    }


    try {

        return JSON.parse(
            text
        );

    } catch (error) {

        console.error(
            `خطا در خواندن ${fileName}:`,
            error
        );


        throw new Error(
            `فایل ${fileName} قابل خواندن نیست.`
        );
    }
}


async function writeJSON(
    fileName,
    value
) {

    if (!rootDirectory) {

        throw new Error(
            "پوشه Bizadshop متصل نیست."
        );
    }


    const fileHandle =
        await getFileHandle(
            fileName,
            true
        );


    const writable =
        await fileHandle.createWritable();


    try {

        await writable.write(
            JSON.stringify(
                value,
                null,
                4
            )
        );


        await writable.close();

    } catch (error) {

        try {
            await writable.abort();
        } catch {}

        throw error;
    }
}


// ============================================================
// INITIAL FILES
// ============================================================

async function createRequiredFiles() {

    const defaults = {

        [FILES.products]:
            [],

        [FILES.inventory]:
            [],

        [FILES.sales]:
            [],

        [FILES.saleItems]:
            [],

        [FILES.shop]:
            {},

        [FILES.settings]:
            {}

    };


    for (
        const fileName of
        Object.values(FILES)
    ) {

        const exists =
            await fileExists(
                fileName
            );


        if (!exists) {

            await writeJSON(
                fileName,
                defaults[fileName]
            );
        }
    }
}


// ============================================================
// LOAD ALL DATA
// ============================================================

async function loadAllData() {

    data.products =
        await readJSON(
            FILES.products,
            []
        );


    data.inventory =
        await readJSON(
            FILES.inventory,
            []
        );


    data.sales =
        await readJSON(
            FILES.sales,
            []
        );


    data.saleItems =
        await readJSON(
            FILES.saleItems,
            []
        );


    data.shop =
        await readJSON(
            FILES.shop,
            {}
        );


    data.settings =
        await readJSON(
            FILES.settings,
            {}
        );


    /*
     * سازگاری با ساختارهای اشتباه احتمالی
     */

    if (!Array.isArray(data.products)) {
        data.products = [];
    }

    if (!Array.isArray(data.inventory)) {
        data.inventory = [];
    }

    if (!Array.isArray(data.sales)) {
        data.sales = [];
    }

    if (!Array.isArray(data.saleItems)) {
        data.saleItems = [];
    }

    if (
        !data.shop ||
        typeof data.shop !== "object" ||
        Array.isArray(data.shop)
    ) {
        data.shop = {};
    }

    if (
        !data.settings ||
        typeof data.settings !== "object" ||
        Array.isArray(data.settings)
    ) {
        data.settings = {};
    }
}


// ============================================================
// SAVE DATA
// ============================================================

async function saveProducts() {

    await writeJSON(
        FILES.products,
        data.products
    );
}


async function saveInventory() {

    await writeJSON(
        FILES.inventory,
        data.inventory
    );
}


async function saveSales() {

    await writeJSON(
        FILES.sales,
        data.sales
    );
}


async function saveSaleItems() {

    await writeJSON(
        FILES.saleItems,
        data.saleItems
    );
}


async function saveShop() {

    await writeJSON(
        FILES.shop,
        data.shop
    );
}


async function saveSettings() {

    await writeJSON(
        FILES.settings,
        data.settings
    );
}


// ============================================================
// STORAGE STATUS
// ============================================================

function updateStorageStatus() {

    const status =
        document.getElementById(
            "storageStatus"
        );

    const icon =
        document.getElementById(
            "storageStatusIcon"
        );

    const title =
        document.getElementById(
            "storageStatusTitle"
        );

    const description =
        document.getElementById(
            "storageStatusDescription"
        );

    const button =
        document.getElementById(
            "connectFolderBtn"
        );


    if (
        !status ||
        !icon ||
        !title ||
        !description ||
        !button
    ) {
        return;
    }


    status.classList.remove(
        "connected",
        "error"
    );


    if (!isFileSystemSupported()) {

        icon.textContent =
            "⚠️";

        title.textContent =
            "مرورگر پشتیبانی نمی‌کند";

        description.textContent =
            "این مرورگر دسترسی مستقیم به پوشه حافظه را پشتیبانی نمی‌کند.";

        button.textContent =
            "بررسی مرورگر";

        return;
    }


    if (!rootDirectory) {

        icon.textContent =
            "💾";

        title.textContent =
            "پوشه ذخیره‌سازی متصل نیست";

        description.textContent =
            "برای شروع، پوشه Bizadshop را انتخاب کنید.";

        button.textContent =
            "انتخاب پوشه";

        return;
    }


    status.classList.add(
        "connected"
    );


    icon.textContent =
        "✅";

    title.textContent =
        "ذخیره‌سازی فعال است";

    description.textContent =
        "اطلاعات در پوشه Bizadshop روی حافظه دستگاه ذخیره می‌شود.";

    button.textContent =
        "تغییر پوشه";
}


function showStorageError(
    message
) {

    const status =
        document.getElementById(
            "storageStatus"
        );

    const icon =
        document.getElementById(
            "storageStatusIcon"
        );

    const title =
        document.getElementById(
            "storageStatusTitle"
        );

    const description =
        document.getElementById(
            "storageStatusDescription"
        );


    if (status) {

        status.classList.add(
            "error"
        );
    }


    if (icon) {

        icon.textContent =
            "⚠️";
    }


    if (title) {

        title.textContent =
            "خطا در ذخیره‌سازی";
    }


    if (description) {

        description.textContent =
            message;
    }
}


// ============================================================
// STORAGE MODAL
// ============================================================

function openStorageModal() {

    const modal =
        document.getElementById(
            "storageModal"
        );


    if (!modal) {
        return;
    }


    updateStorageModal();


    modal.classList.add(
        "show"
    );
}


function updateStorageModal() {

    const status =
        document.getElementById(
            "storageModalStatus"
        );

    const button =
        document.getElementById(
            "storageModalConnectBtn"
        );


    if (!status || !button) {
        return;
    }


    if (!isFileSystemSupported()) {

        status.textContent =
            "این مرورگر از ذخیره‌سازی مستقیم در پوشه حافظه پشتیبانی نمی‌کند.";

        button.textContent =
            "مرورگر پشتیبانی نمی‌کند";

        button.disabled =
            true;

        return;
    }


    button.disabled =
        false;


    if (rootDirectory) {

        status.textContent =
            "پوشه Bizadshop متصل است و اطلاعات در فایل‌های JSON ذخیره می‌شوند.";

        button.textContent =
            "تغییر پوشه";

    } else {

        status.textContent =
            "هنوز پوشه‌ای برای ذخیره اطلاعات انتخاب نشده است.";

        button.textContent =
            "انتخاب پوشه";
    }
}


// ============================================================
// PRODUCTS
// ============================================================

async function getProducts() {

    return data.products;
}


async function getProduct(
    id
) {

    return data.products.find(
        product =>
            product.id === id
    );
}


async function getProductByBarcode(
    barcode
) {

    const normalized =
        String(
            barcode ?? ""
        ).trim();


    if (!normalized) {
        return undefined;
    }


    return data.products.find(
        product =>
            String(
                product.barcode ?? ""
            ).trim() ===
            normalized
    );
}


// ============================================================
// INVENTORY
// ============================================================

async function getInventory(
    productId
) {

    return data.inventory.find(
        item =>
            item.productId ===
            productId
    );
}


async function getQuantity(
    productId
) {

    const inventory =
        await getInventory(
            productId
        );


    return inventory
        ? Number(
            inventory.quantity
        ) || 0
        : 0;
}


async function setQuantity(
    productId,
    quantity
) {

    const numericQuantity =
        Number(
            quantity
        ) || 0;


    const existing =
        await getInventory(
            productId
        );


    if (existing) {

        existing.quantity =
            numericQuantity;

        existing.updatedAt =
            nowISO();

    } else {

        data.inventory.push({

            productId:
                productId,

            quantity:
                numericQuantity,

            updatedAt:
                nowISO()

        });
    }


    await saveInventory();
}


// ============================================================
// SAVE PRODUCT
// ============================================================

async function saveProduct(
    product
) {

    /*
     * بارکد اختیاری است.
     *
     * اگر وارد شده باشد،
     * نباید تکراری باشد.
     */

    if (product.barcode) {

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
    }


    const existing =
        await getProduct(
            product.id
        );


    if (existing) {

        Object.assign(
            existing,
            product
        );

    } else {

        data.products.push(
            product
        );
    }


    await saveProducts();


    const currentInventory =
        await getInventory(
            product.id
        );


    if (!currentInventory) {

        data.inventory.push({

            productId:
                product.id,

            quantity:
                Number(
                    product.initialQuantity
                ) || 0,

            updatedAt:
                nowISO()

        });


        await saveInventory();
    }


    return product;
}


// ============================================================
// PRODUCT FORM
// ============================================================

document
    .getElementById(
        "productForm"
    )
    .addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            try {

                ensureReady();


                const id =
                    document
                        .getElementById(
                            "productId"
                        )
                        .value
                        .trim();


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


                if (!name) {

                    throw new Error(
                        "نام کالا را وارد کنید."
                    );
                }


                if (
                    purchasePrice < 0 ||
                    salePrice < 0 ||
                    initialQuantity < 0
                ) {

                    throw new Error(
                        "مقادیر عددی نامعتبر هستند."
                    );
                }


                let product;


                if (id) {

                    product =
                        await getProduct(
                            id
                        );


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
                    .value =
                        "";


                document
                    .getElementById(
                        "initialQuantity"
                    )
                    .value =
                        "0";


                await refreshAll();


                showToast(
                    id
                        ? "کالا ویرایش شد."
                        : "کالا با موفقیت اضافه شد."
                );


            } catch (error) {

                console.error(
                    error
                );


                showToast(
                    error.message ||
                    "خطایی رخ داد."
                );
            }

        }
    );


// ============================================================
// EDIT PRODUCT
// ============================================================

async function editProduct(
    productId
) {

    try {

        ensureReady();


        const product =
            await getProduct(
                productId
            );


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
                product.barcode || "";


        document
            .getElementById(
                "productName"
            )
            .value =
                product.name || "";


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

    } catch (error) {

        showToast(
            error.message
        );
    }
}


// ============================================================
// DELETE PRODUCT
// ============================================================

async function deleteProduct(
    productId
) {

    try {

        ensureReady();


        const product =
            await getProduct(
                productId
            );


        if (!product) {
            return;
        }


        const confirmed =
            confirm(
                `کالای «${product.name}» حذف شود؟`
            );


        if (!confirmed) {
            return;
        }


        data.products =
            data.products.filter(
                item =>
                    item.id !==
                    productId
            );


        data.inventory =
            data.inventory.filter(
                item =>
                    item.productId !==
                    productId
            );


        cart =
            cart.filter(
                item =>
                    item.productId !==
                    productId
            );


        await saveProducts();

        await saveInventory();


        await refreshAll();

        renderCart();


        showToast(
            "کالا حذف شد."
        );


    } catch (error) {

        showToast(
            error.message ||
            "حذف کالا ناموفق بود."
        );
    }
}


// ============================================================
// PRODUCTS LIST
// ============================================================

async function renderProducts(
    search = ""
) {

    const container =
        document.getElementById(
            "productsList"
        );


    if (!container) {
        return;
    }


    let products =
        await getProducts();


    const text =
        search
            .trim()
            .toLowerCase();


    if (text) {

        products =
            products.filter(
                product => {

                    const name =
                        String(
                            product.name ||
                            ""
                        )
                        .toLowerCase();


                    const barcode =
                        String(
                            product.barcode ||
                            ""
                        )
                        .toLowerCase();


                    const category =
                        String(
                            product.category ||
                            ""
                        )
                        .toLowerCase();


                    return (
                        name.includes(text)
                        ||
                        barcode.includes(text)
                        ||
                        category.includes(text)
                    );
                }
            );
    }


    products =
        [...products]
            .sort(
                (a, b) =>
                    String(
                        b.createdAt ||
                        ""
                    )
                    .localeCompare(
                        String(
                            a.createdAt ||
                            ""
                        )
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


    for (
        const product of products
    ) {

        const quantity =
            await getQuantity(
                product.id
            );


        let stockClass =
            "good";


        if (quantity <= 0) {

            stockClass =
                "empty";

        } else if (quantity <= 5) {

            stockClass =
                "low";
        }


        const barcodeText =
            product.barcode
                ? escapeHTML(
                    product.barcode
                )
                : "بدون بارکد";


        html += `

            <div class="product-card">

                <div class="product-main">

                    <div class="product-info">

                        <div class="product-name">
                            ${escapeHTML(
                                product.name
                            )}
                        </div>

                        <div class="product-barcode">
                            ${barcodeText}
                        </div>

                    </div>

                    <div class="product-price">

                        <small>
                            قیمت فروش
                        </small>

                        <strong>
                            ${formatMoney(
                                product.salePrice
                            )}
                        </strong>

                    </div>

                </div>


                <div class="product-bottom">

                    <div class="stock ${stockClass}">
                        موجودی:
                        ${quantity.toLocaleString(
                            "fa-IR"
                        )}
                        ${escapeHTML(
                            product.unit ||
                            "عدد"
                        )}
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


    container.innerHTML =
        html;
}


// ============================================================
// INVENTORY
// ============================================================

async function renderInventory(
    search = ""
) {

    const container =
        document.getElementById(
            "inventoryList"
        );


    if (!container) {
        return;
    }


    let products =
        await getProducts();


    const text =
        search
            .trim()
            .toLowerCase();


    if (text) {

        products =
            products.filter(
                product => {

                    const name =
                        String(
                            product.name ||
                            ""
                        )
                        .toLowerCase();


                    const barcode =
                        String(
                            product.barcode ||
                            ""
                        )
                        .toLowerCase();


                    return (
                        name.includes(text)
                        ||
                        barcode.includes(text)
                    );
                }
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


    for (
        const product of products
    ) {

        const quantity =
            await getQuantity(
                product.id
            );


        let stockClass =
            "good";


        if (quantity <= 0) {

            stockClass =
                "empty";

        } else if (quantity <= 5) {

            stockClass =
                "low";
        }


        html += `

            <div class="product-card">

                <div class="product-main">

                    <div class="product-info">

                        <div class="product-name">
                            ${escapeHTML(
                                product.name
                            )}
                        </div>

                        <div class="product-barcode">
                            ${
                                product.barcode
                                    ? escapeHTML(
                                        product.barcode
                                    )
                                    : "بدون بارکد"
                            }
                        </div>

                    </div>

                    <div class="stock ${stockClass}">
                        ${quantity.toLocaleString(
                            "fa-IR"
                        )}
                        ${escapeHTML(
                            product.unit ||
                            "عدد"
                        )}
                    </div>

                </div>


                <div class="product-bottom">

                    <span>
                        قیمت فروش:
                        ${formatMoney(
                            product.salePrice
                        )}
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


    container.innerHTML =
        html;
}


// ============================================================
// STOCK MODAL
// ============================================================

async function openStockModal(
    productId
) {

    try {

        ensureReady();


        const product =
            await getProduct(
                productId
            );


        if (!product) {
            return;
        }


        const quantity =
            await getQuantity(
                productId
            );


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
                `${product.name} — موجودی فعلی: ${
                    quantity.toLocaleString(
                        "fa-IR"
                    )
                }`;


        document
            .getElementById(
                "stockAmount"
            )
            .value =
                "";


        document
            .getElementById(
                "stockAction"
            )
            .value =
                "increase";


        openModal(
            "stockModal"
        );

    } catch (error) {

        showToast(
            error.message
        );
    }
}


// ============================================================
// STOCK FORM
// ============================================================

document
    .getElementById(
        "stockForm"
    )
    .addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            try {

                ensureReady();


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
                    action ===
                    "increase"
                ) {

                    newQuantity =
                        current +
                        amount;

                } else if (
                    action ===
                    "decrease"
                ) {

                    if (
                        amount >
                        current
                    ) {

                        throw new Error(
                            "موجودی کافی نیست."
                        );
                    }


                    newQuantity =
                        current -
                        amount;

                } else {

                    newQuantity =
                        amount;
                }


                await setQuantity(
                    productId,
                    newQuantity
                );


                closeModal(
                    "stockModal"
                );


                await refreshAll();


                showToast(
                    "موجودی به‌روزرسانی شد."
                );


            } catch (error) {

                showToast(
                    error.message ||
                    "خطا در تغییر موجودی."
                );
            }

        }
    );


// ============================================================
// SALES
// ============================================================

async function addToCart(
    productId
) {

    try {

        ensureReady();


        const product =
            await getProduct(
                productId
            );


        if (!product) {
            return;
        }


        const quantity =
            await getQuantity(
                productId
            );


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


    } catch (error) {

        showToast(
            error.message
        );
    }
}


// ============================================================
// REMOVE FROM CART
// ============================================================

function removeFromCart(
    productId
) {

    cart =
        cart.filter(
            item =>
                item.productId !==
                productId
        );


    renderCart();
}


// ============================================================
// CHANGE CART QUANTITY
// ============================================================

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


    if (!item) {
        return;
    }


    const stock =
        await getQuantity(
            productId
        );


    const newQuantity =
        item.quantity +
        change;


    if (newQuantity <= 0) {

        removeFromCart(
            productId
        );

        return;
    }


    if (
        newQuantity >
        stock
    ) {

        showToast(
            "موجودی کافی نیست."
        );

        return;
    }


    item.quantity =
        newQuantity;


    renderCart();
}


// ============================================================
// CART
// ============================================================

async function renderCart() {

    const container =
        document.getElementById(
            "cartList"
        );


    if (!container) {
        return;
    }


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


    for (
        const item of cart
    ) {

        const product =
            await getProduct(
                item.productId
            );


        if (!product) {
            continue;
        }


        const itemTotal =
            Number(
                product.salePrice
            ) *
            item.quantity;


        total +=
            itemTotal;


        html += `

            <div class="cart-item">

                <div class="cart-info">

                    <strong>
                        ${escapeHTML(
                            product.name
                        )}
                    </strong>

                    <small>
                        ${formatMoney(
                            product.salePrice
                        )}
                        ×
                        ${item.quantity.toLocaleString(
                            "fa-IR"
                        )}
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
                        ${item.quantity.toLocaleString(
                            "fa-IR"
                        )}
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

    try {

        ensureReady();


        if (!cart.length) {

            showToast(
                "سبد فروش خالی است."
            );

            return;
        }


        const saleId =
            generateId(
                "sale"
            );


        const createdAt =
            nowISO();


        let total = 0;

        const saleItems = [];


        // ----------------------------------------------------
        // Check stock first
        // ----------------------------------------------------

        for (
            const item of cart
        ) {

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
                Number(
                    product.salePrice
                ) *
                item.quantity;


            total +=
                itemTotal;


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
                    Number(
                        product.salePrice
                    ),

                totalPrice:
                    itemTotal

            });
        }


        // ----------------------------------------------------
        // Save sale
        // ----------------------------------------------------

        data.sales.push({

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


        // ----------------------------------------------------
        // Save sale items
        // ----------------------------------------------------

        for (
            const item of saleItems
        ) {

            data.saleItems.push(
                item
            );
        }


        // ----------------------------------------------------
        // Decrease stock in memory
        // ----------------------------------------------------

        for (
            const item of saleItems
        ) {

            const current =
                await getQuantity(
                    item.productId
                );


            const inventory =
                await getInventory(
                    item.productId
                );


            if (inventory) {

                inventory.quantity =
                    current -
                    item.quantity;

                inventory.updatedAt =
                    nowISO();

            } else {

                data.inventory.push({

                    productId:
                        item.productId,

                    quantity:
                        current -
                        item.quantity,

                    updatedAt:
                        nowISO()

                });
            }
        }


        // ----------------------------------------------------
        // Write files
        // ----------------------------------------------------

        await saveSales();

        await saveSaleItems();

        await saveInventory();


        cart = [];


        await refreshAll();

        renderCart();


        showToast(
            "فروش با موفقیت ثبت شد."
        );


    } catch (error) {

        console.error(
            "Checkout error:",
            error
        );


        showToast(
            error.message ||
            "ثبت فروش ناموفق بود."
        );
    }
}


// ============================================================
// TODAY SALES
// ============================================================

async function getTodaySales() {

    return data.sales.filter(
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


    for (
        const product of products
    ) {

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


    if (!container) {
        return;
    }


    const products =
        await getProducts();


    const lowStock = [];


    for (
        const product of products
    ) {

        const quantity =
            await getQuantity(
                product.id
            );


        if (
            quantity <= 5
        ) {

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
        const item of lowStock
            .slice(0, 5)
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
                            ${
                                item.product.barcode
                                    ? escapeHTML(
                                        item.product.barcode
                                    )
                                    : "بدون بارکد"
                            }
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


    let total =
        0;


    for (
        const product of products
    ) {

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

async function renderSaleSearch(
    text
) {

    const container =
        document.getElementById(
            "saleSearchResults"
        );


    if (!container) {
        return;
    }


    text =
        String(
            text || ""
        )
        .trim()
        .toLowerCase();


    if (!text) {

        container.innerHTML =
            "";

        return;
    }


    const products =
        await getProducts();


    const results =
        products.filter(
            product => {

                const name =
                    String(
                        product.name ||
                        ""
                    )
                    .toLowerCase();


                const barcode =
                    String(
                        product.barcode ||
                        ""
                    )
                    .toLowerCase();


                return (
                    name.includes(text)
                    ||
                    barcode.includes(text)
                );
            }
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


    for (
        const product of results
    ) {

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
                        ${
                            product.barcode
                                ? escapeHTML(
                                    product.barcode
                                )
                                : "بدون بارکد"
                        }
                        ·
                        موجودی:
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

function showPage(
    pageName
) {

    document
        .querySelectorAll(
            ".page"
        )
        .forEach(
            page =>
                page.classList.remove(
                    "active"
                )
        );


    const page =
        document.getElementById(
            pageName +
            "Page"
        );


    if (page) {

        page.classList.add(
            "active"
        );
    }


    document
        .querySelectorAll(
            ".nav-btn"
        )
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

function openModal(
    id
) {

    const modal =
        document.getElementById(
            id
        );


    if (modal) {

        modal.classList.add(
            "show"
        );
    }
}


function closeModal(
    id
) {

    const modal =
        document.getElementById(
            id
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );
    }
}


document
    .querySelectorAll(
        "[data-close-modal]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset
                            .closeModal
                    );

                }
            );

        }
    );


document
    .querySelectorAll(
        ".modal"
    )
    .forEach(
        modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList
                            .remove(
                                "show"
                            );
                    }

                }
            );

        }
    );


// ============================================================
// ADD PRODUCT BUTTON
// ============================================================

function openAddProductModal() {

    if (!isReady) {

        showToast(
            "ابتدا پوشه Bizadshop را انتخاب کنید."
        );

        return;
    }


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
        .value =
            "";


    document
        .getElementById(
            "initialQuantity"
        )
        .value =
            "0";


    openModal(
        "productModal"
    );
}


// ============================================================
// READY CHECK
// ============================================================

function ensureReady() {

    if (
        !rootDirectory ||
        !isReady
    ) {

        throw new Error(
            "ابتدا پوشه Bizadshop را انتخاب کنید."
        );
    }
}


// ============================================================
// EVENT LISTENERS
// ============================================================

document
    .querySelectorAll(
        ".nav-btn"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    const page =
                        button.dataset
                            .page;


                    showPage(
                        page
                    );


                    if (!isReady) {

                        return;
                    }


                    if (
                        page ===
                        "products"
                    ) {

                        await renderProducts();

                    }


                    if (
                        page ===
                        "inventory"
                    ) {

                        await renderInventory();

                        await renderInventorySummary();

                    }


                    if (
                        page ===
                        "sale"
                    ) {

                        renderCart();

                    }

                }
            );

        }
    );


// ------------------------------------------------------------
// Connect folder
// ------------------------------------------------------------

document
    .getElementById(
        "connectFolderBtn"
    )
    .addEventListener(
        "click",
        chooseStorageFolder
    );


document
    .getElementById(
        "storageModalConnectBtn"
    )
    .addEventListener(
        "click",
        async () => {

            closeModal(
                "storageModal"
            );

            await chooseStorageFolder();

        }
    );


// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

document
    .getElementById(
        "settingsBtn"
    )
    .addEventListener(
        "click",
        openStorageModal
    );


// ------------------------------------------------------------
// Quick actions
// ------------------------------------------------------------

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
        openAddProductModal
    );


document
    .getElementById(
        "quickSale"
    )
    .addEventListener(
        "click",
        () => {

            if (!isReady) {

                showToast(
                    "ابتدا پوشه Bizadshop را انتخاب کنید."
                );

                return;
            }


            showPage(
                "sale"
            );

            renderCart();

        }
    );


// ------------------------------------------------------------
// Searches
// ------------------------------------------------------------

document
    .getElementById(
        "productSearch"
    )
    .addEventListener(
        "input",
        event => {

            if (!isReady) {
                return;
            }


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

            if (!isReady) {
                return;
            }


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

            if (!isReady) {
                return;
            }


            renderSaleSearch(
                event.target.value
            );

        }
    );


// ------------------------------------------------------------
// Cart
// ------------------------------------------------------------

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

            await checkout();

        }
    );


// ------------------------------------------------------------
// Low stock
// ------------------------------------------------------------

document
    .getElementById(
        "showLowStock"
    )
    .addEventListener(
        "click",
        async () => {

            if (!isReady) {

                showToast(
                    "ابتدا پوشه Bizadshop را انتخاب کنید."
                );

                return;
            }


            showPage(
                "inventory"
            );


            await renderInventory();

            await renderInventorySummary();

        }
    );


// ============================================================
// BARCODE INPUT
// ============================================================

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


// ============================================================
// SCANNER
// ============================================================

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

    if (!isReady) {
        return;
    }


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

    updateStorageStatus();


    if (!isFileSystemSupported()) {

        showStorageError(
            "برای ذخیره مستقیم اطلاعات در پوشه حافظه، از مرورگری استفاده کنید که File System Access را پشتیبانی کند."
        );

        return;
    }


    /*
     * در این نسخه برنامه خودش بدون اجازه کاربر
     * وارد حافظه نمی‌شود.
     *
     * کاربر باید دکمه انتخاب پوشه را بزند.
     */

    console.log(
        "Bizadshop آماده است. منتظر انتخاب پوشه."
    );
}


document.addEventListener(
    "DOMContentLoaded",
    initApp
);
