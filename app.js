```javascript
// ============================================================
// Bizadshop
// Folder Storage Edition
//
// اطلاعات اصلی داخل فایل:
// Bizadshop/bizadshop-data.json
//
// IndexedDB فقط برای نگه داشتن مجوز/آدرس پوشه استفاده می‌شود.
// اطلاعات فروشگاه داخل IndexedDB ذخیره نمی‌شود.
// ============================================================


const DATA_FILE_NAME = "bizadshop-data.json";

const HANDLE_DB_NAME = "BizadshopFolderDB";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_KEY = "main-folder";

let folderHandle = null;

let database = {
    products: [],
    inventory: {},
    sales: [],
    sale_items: [],
    settings: {}
};

let cart = [];

let saveTimer = null;


// ============================================================
// BASIC UTILITIES
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

    return new Date().toISOString();
}


function formatMoney(value) {

    return (
        Number(value) || 0
    ).toLocaleString("fa-IR") + " تومان";
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
        document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);
}


function setConnectionStatus(text) {

    const element =
        document.getElementById(
            "connectionStatus"
        );

    if (element) {
        element.textContent = text;
    }
}


// ============================================================
// HANDLE DATABASE
//
// این دیتابیس فقط برای نگه داشتن Folder Handle است.
// اطلاعات فروشگاه در اینجا ذخیره نمی‌شود.
// ============================================================

function openHandleDB() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                HANDLE_DB_NAME,
                HANDLE_DB_VERSION
            );


        request.onupgradeneeded =
            function (event) {

                const db =
                    event.target.result;

                if (
                    !db.objectStoreNames.contains(
                        HANDLE_STORE
                    )
                ) {

                    db.createObjectStore(
                        HANDLE_STORE
                    );
                }
            };


        request.onsuccess =
            function () {

                resolve(
                    request.result
                );
            };


        request.onerror =
            function () {

                reject(
                    request.error
                );
            };

    });
}


async function saveFolderHandle(handle) {

    const db =
        await openHandleDB();

    return new Promise(
        (resolve, reject) => {

            const tx =
                db.transaction(
                    HANDLE_STORE,
                    "readwrite"
                );

            tx.objectStore(
                HANDLE_STORE
            ).put(
                handle,
                HANDLE_KEY
            );

            tx.oncomplete = () => {

                db.close();

                resolve();
            };

            tx.onerror = () => {

                db.close();

                reject(
                    tx.error
                );
            };

        }
    );
}


async function getFolderHandle() {

    const db =
        await openHandleDB();

    return new Promise(
        (resolve, reject) => {

            const tx =
                db.transaction(
                    HANDLE_STORE,
                    "readonly"
                );

            const request =
                tx.objectStore(
                    HANDLE_STORE
                ).get(
                    HANDLE_KEY
                );


            request.onsuccess =
                () => {

                    db.close();

                    resolve(
                        request.result ||
                        null
                    );
                };


            request.onerror =
                () => {

                    db.close();

                    reject(
                        request.error
                    );
                };

        }
    );
}


async function deleteFolderHandle() {

    const db =
        await openHandleDB();

    return new Promise(
        (resolve, reject) => {

            const tx =
                db.transaction(
                    HANDLE_STORE,
                    "readwrite"
                );

            tx.objectStore(
                HANDLE_STORE
            ).delete(
                HANDLE_KEY
            );


            tx.oncomplete = () => {

                db.close();

                resolve();
            };


            tx.onerror = () => {

                db.close();

                reject(
                    tx.error
                );
            };

        }
    );
}


// ============================================================
// FOLDER PERMISSION
// ============================================================

async function hasReadWritePermission(handle) {

    if (!handle) {
        return false;
    }


    try {

        const permission =
            await handle.queryPermission({
                mode: "readwrite"
            });


        return permission === "granted";

    } catch (error) {

        console.error(error);

        return false;
    }
}


// ============================================================
// SELECT FOLDER
// ============================================================

async function chooseFolder() {

    if (
        !("showDirectoryPicker" in window)
    ) {

        showToast(
            "این مرورگر از اتصال مستقیم به پوشه پشتیبانی نمی‌کند."
        );

        setConnectionStatus(
            "مرورگر پشتیبانی نمی‌کند"
        );

        return false;
    }


    try {

        const handle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });


        folderHandle = handle;


        const permission =
            await handle.queryPermission({
                mode: "readwrite"
            });


        if (
            permission !== "granted"
        ) {

            const requested =
                await handle.requestPermission({
                    mode: "readwrite"
                });


            if (
                requested !== "granted"
            ) {

                folderHandle = null;

                showToast(
                    "اجازه دسترسی به پوشه داده نشد."
                );

                return false;
            }
        }


        await saveFolderHandle(
            folderHandle
        );


        await ensureDataFile();

        await loadDataFromFolder();


        setConnectionStatus(
            "متصل به پوشه: " +
            folderHandle.name
        );


        await refreshAll();


        showToast(
            "پوشه Bizadshop متصل شد."
        );


        return true;

    } catch (error) {

        console.error(error);

        if (
            error.name !==
            "AbortError"
        ) {

            showToast(
                "اتصال پوشه ناموفق بود."
            );
        }

        return false;
    }
}


// ============================================================
// AUTO CONNECT
// ============================================================

async function tryAutoConnect() {

    try {

        const handle =
            await getFolderHandle();


        if (!handle) {

            setConnectionStatus(
                "پوشه متصل نیست"
            );

            return false;
        }


        folderHandle =
            handle;


        const permission =
            await hasReadWritePermission(
                folderHandle
            );


        if (!permission) {

            setConnectionStatus(
                "برای اتصال دوباره روی 📁 بزنید"
            );

            return false;
        }


        await ensureDataFile();

        await loadDataFromFolder();


        setConnectionStatus(
            "متصل به پوشه: " +
            folderHandle.name
        );


        await refreshAll();


        return true;

    } catch (error) {

        console.error(error);

        folderHandle = null;

        setConnectionStatus(
            "اتصال نیاز به تأیید دارد"
        );

        return false;
    }
}


// ============================================================
// DATA FILE
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


async function ensureDataFile() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    let fileHandle;


    try {

        fileHandle =
            await folderHandle.getFileHandle(
                DATA_FILE_NAME
            );

    } catch (error) {

        fileHandle =
            await folderHandle.getFileHandle(
                DATA_FILE_NAME,
                {
                    create: true
                }
            );


        const file =
            await fileHandle.createWritable();


        await file.write(
            JSON.stringify(
                createEmptyDatabase(),
                null,
                2
            )
        );


        await file.close();
    }


    return fileHandle;
}


// ============================================================
// READ DATA
// ============================================================

async function loadDataFromFolder() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    const fileHandle =
        await ensureDataFile();


    const file =
        await fileHandle.getFile();


    const text =
        await file.text();


    if (!text.trim()) {

        database =
            createEmptyDatabase();

        await saveDataToFolder();

        return;
    }


    try {

        const parsed =
            JSON.parse(text);


        database = {

            version:
                parsed.version || 1,

            products:
                Array.isArray(
                    parsed.products
                )
                    ? parsed.products
                    : [],

            inventory:
                parsed.inventory &&
                typeof parsed.inventory ===
                    "object"
                    ? parsed.inventory
                    : {},

            sales:
                Array.isArray(
                    parsed.sales
                )
                    ? parsed.sales
                    : [],

            sale_items:
                Array.isArray(
                    parsed.sale_items
                )
                    ? parsed.sale_items
                    : [],

            settings:
                parsed.settings &&
                typeof parsed.settings ===
                    "object"
                    ? parsed.settings
                    : {}

        };


    } catch (error) {

        throw new Error(
            "فایل اطلاعات فروشگاه خراب یا نامعتبر است."
        );
    }
}


// ============================================================
// WRITE DATA
// ============================================================

async function saveDataToFolder() {

    if (!folderHandle) {

        throw new Error(
            "پوشه Bizadshop متصل نیست."
        );
    }


    const permission =
        await hasReadWritePermission(
            folderHandle
        );


    if (!permission) {

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


// ============================================================
// SAVE WITH ERROR HANDLING
// ============================================================

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


async function getProductByBarcode(
    barcode
) {

    return database.products.find(
        product =>
            String(product.barcode)
                .trim() ===
            String(barcode)
                .trim()
    );
}


// ============================================================
// INVENTORY
// ============================================================

async function getQuantity(productId) {

    return Number(
        database.inventory[
            productId
        ]?.quantity
    ) || 0;
}


async function setQuantity(
    productId,
    quantity
) {

    database.inventory[
        productId
    ] = {

        productId:
            productId,

        quantity:
            Number(quantity) || 0,

        updatedAt:
            nowISO()

    };
}


// ============================================================
// PRODUCT SAVE
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
        !database.inventory[
            product.id
        ]
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
                    error.message
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

async function deleteProduct(
    productId
) {

    const product =
        await getProduct(
            productId
        );


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

async function renderProducts(
    search = ""
) {

    const container =
        document.getElementById(
            "productsList"
        );


    let products =
        await getProducts();


    const text =
        search
            .trim()
            .toLowerCase();


    if (text) {

        products =
            products.filter(
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
                    ||
                    String(
                        product.category ||
                        ""
                    )
                    .toLowerCase()
                    .includes(text)
            );
    }


    products.sort(
        (a, b) =>
            b.createdAt.localeCompare(
                a.createdAt
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
                        ${escapeHTML(
                            product.name
                        )}
                    </div>

                    <div class="product-barcode">
                        ${escapeHTML(
                            product.barcode
                        )}
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
                        product.unit || "عدد"
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
// INVENTORY LIST
// ============================================================

async function renderInventory(
    search = ""
) {

    const container =
        document.getElementById(
            "inventoryList"
        );


    let products =
        await getProducts();


    const text =
        search
            .trim()
            .toLowerCase();


    if (text) {

        products =
            products.filter(
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
                        ${escapeHTML(
                            product.name
                        )}
                    </div>

                    <div class="product-barcode">
                        ${escapeHTML(
                            product.barcode
                        )}
                    </div>

                </div>


                <div class="stock ${stockClass}">
                    ${quantity.toLocaleString(
                        "fa-IR"
                    )}
                    ${escapeHTML(
                        product.unit || "عدد"
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

    const product =
        await getProduct(
            productId
        );


    if (!product) return;


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

                    if (
                        amount > current
                    ) {

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
// SALES / CART
// ============================================================

async function addToCart(
    productId
) {

    const product =
        await getProduct(
            productId
        );


    if (!product) return;


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
}


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


        if (!product) continue;


        const itemTotal =
            Number(
                product.salePrice
            ) *
            item.quantity;


        total += itemTotal;


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
                Number(
                    product.salePrice
                ),

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


    for (
        const item of saleItems
    ) {

        database.sale_items.push(
            item
        );


        const current =
            await getQuantity(
                item.productId
            );


        await setQuantity(
            item.productId,
            current -
            item.quantity
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

function isToday(
    isoDate
) {

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

function showPage(
    pageName
) {

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

    document
        .getElementById(id)
        .classList.add("show");
}


function closeModal(id) {

    document
        .getElementById(id)
        .classList.remove("show");
}


document
    .querySelectorAll("[data-close-modal]")
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

                        modal.classList
                            .remove("show");
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
                        button.dataset
                            .page;


                    showPage(page);


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

    try {

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


        const connected =
            await tryAutoConnect();


        if (!connected) {

            setConnectionStatus(
                "برای اتصال پوشه روی 📁 بزنید"
            );


            database =
                createEmptyDatabase();


            await refreshAll();
        }


        console.log(
            "Bizadshop آماده است."
        );


    } catch (error) {

        console.error(error);

        setConnectionStatus(
            "اتصال پوشه برقرار نیست"
        );

        showToast(
            "خطا در راه‌اندازی Bizadshop"
        );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    initApp
);
```
