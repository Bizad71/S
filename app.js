// ============================================================
// Bizadshop
// Permanent Folder Connection Edition
//
// اطلاعات فروشگاه فقط داخل:
// Bizadshop/bizadshop-data.json
//
// IndexedDB فقط Folder Handle را نگه می‌دارد.
//
// هدف:
// 1. بعد از Refresh دوباره پوشه قبلی را پیدا کند.
// 2. برای اتصال خودکار از queryPermission استفاده نکند.
// 3. اگر دسترسی قبلی برقرار بود، مستقیم فایل را بخواند.
// 4. اگر دسترسی واقعاً از بین رفته بود، فقط آن موقع درخواست اتصال کند.
// 5. در صورت شکست اتصال، دیتابیس را خالی نکند.
// 6. اطلاعات فروشگاه هرگز با Refresh صفر نشود.
// ============================================================


"use strict";


// ============================================================
// CONFIG
// ============================================================

const DATA_FILE_NAME =
    "bizadshop-data.json";

const HANDLE_DB_NAME =
    "BizadshopFolderDB";

const HANDLE_DB_VERSION = 1;

const HANDLE_STORE =
    "handles";

const HANDLE_KEY =
    "main-folder";


// ============================================================
// GLOBAL STATE
// ============================================================

let folderHandle = null;

let folderConnected = false;

let connectionChecking = false;

let database =
    createEmptyDatabase();

let cart = [];


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
    ).toLocaleString("fa-IR") +
    " تومان";
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

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2500);
}


function setConnectionStatus(
    text,
    state = ""
) {

    const element =
        document.getElementById(
            "connectionStatus"
        );

    if (!element) return;

    element.textContent =
        text;

    element.classList.remove(
        "connected",
        "error"
    );

    if (state) {

        element.classList.add(
            state
        );
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

    return new Promise(
        (resolve, reject) => {

            if (
                !("indexedDB" in window)
            ) {

                reject(
                    new Error(
                        "IndexedDB در این مرورگر فعال نیست."
                    )
                );

                return;
            }


            const request =
                indexedDB.open(
                    HANDLE_DB_NAME,
                    HANDLE_DB_VERSION
                );


            request.onupgradeneeded =
                event => {

                    const db =
                        event.target.result;


                    if (
                        !db.objectStoreNames
                            .contains(
                                HANDLE_STORE
                            )
                    ) {

                        db.createObjectStore(
                            HANDLE_STORE
                        );
                    }
                };


            request.onsuccess =
                () => {

                    resolve(
                        request.result
                    );
                };


            request.onerror =
                () => {

                    reject(
                        request.error ||
                        new Error(
                            "باز کردن IndexedDB ناموفق بود."
                        )
                    );
                };

        }
    );
}


// ============================================================
// SAVE HANDLE
// ============================================================

async function saveFolderHandle(
    handle
) {

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


            tx.oncomplete =
                () => {

                    db.close();

                    resolve();
                };


            tx.onerror =
                () => {

                    db.close();

                    reject(
                        tx.error
                    );
                };

        }
    );
}


// ============================================================
// GET HANDLE
// ============================================================

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


// ============================================================
// DELETE HANDLE
// ============================================================

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


            tx.oncomplete =
                () => {

                    db.close();

                    resolve();
                };


            tx.onerror =
                () => {

                    db.close();

                    reject(
                        tx.error
                    );
                };

        }
    );
}


// ============================================================
// CHECK API
// ============================================================

function isFolderAPIAvailable() {

    return (
        "showDirectoryPicker" in window
    );
}


// ============================================================
// SELECT FOLDER MANUALLY
//
// فقط زمانی اجرا می‌شود که کاربر روی
// دکمه 📁 بزند.
// ============================================================

async function chooseFolder() {

    if (
        !isFolderAPIAvailable()
    ) {

        setConnectionStatus(
            "مرورگر از اتصال پوشه پشتیبانی نمی‌کند",
            "error"
        );

        showToast(
            "Chrome یا مرورگر سازگار استفاده کنید."
        );

        return false;
    }


    try {

        setConnectionStatus(
            "انتخاب پوشه..."
        );


        const handle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });


        if (!handle) {

            return false;
        }


        folderHandle =
            handle;


        // ابتدا تلاش می‌کنیم بدون درخواست مجدد
        // فایل را باز کنیم.
        //
        // اگر permission لازم باشد، چون این تابع
        // مستقیماً با کلیک کاربر اجرا شده، اجازه
        // درخواست permission داریم.

        let ready =
            await tryUseFolder(
                true
            );


        if (!ready) {

            folderHandle = null;

            setConnectionStatus(
                "اتصال برقرار نشد",
                "error"
            );

            showToast(
                "اتصال به پوشه ناموفق بود."
            );

            return false;
        }


        await saveFolderHandle(
            folderHandle
        );


        folderConnected =
            true;


        setConnectionStatus(
            "متصل: " +
            folderHandle.name,
            "connected"
        );


        await refreshAll();


        showToast(
            "پوشه Bizadshop متصل شد."
        );


        return true;

    } catch (error) {

        console.error(
            "chooseFolder:",
            error
        );


        if (
            error &&
            error.name ===
                "AbortError"
        ) {

            return false;
        }


        folderConnected =
            false;


        setConnectionStatus(
            "اتصال برقرار نشد",
            "error"
        );


        showToast(
            error.message ||
            "اتصال پوشه ناموفق بود."
        );


        return false;
    }
}


// ============================================================
// AUTO CONNECT
//
// مهم:
//
// اینجا queryPermission اجرا نمی‌شود.
//
// چون queryPermission در بعضی محیط‌ها باعث
// معطل ماندن یا رفتار نامناسب می‌شود.
//
// مستقیماً تلاش می‌کنیم از Handle قبلی
// فایل را بخوانیم.
//
// اگر اجازه وجود داشته باشد:
//   مستقیم متصل می‌شود.
//
// اگر اجازه وجود نداشته باشد:
//   فقط پیام اتصال مجدد نمایش داده می‌شود.
// ============================================================

async function tryAutoConnect() {

    if (connectionChecking) {

        return folderConnected;
    }


    connectionChecking =
        true;


    try {

        setConnectionStatus(
            "در حال اتصال..."
        );


        const savedHandle =
            await getFolderHandle();


        if (!savedHandle) {

            folderHandle = null;

            folderConnected =
                false;

            setConnectionStatus(
                "پوشه هنوز متصل نشده است",
                "error"
            );

            return false;
        }


        folderHandle =
            savedHandle;


        // بدون queryPermission
        // مستقیماً فایل را امتحان می‌کنیم.

        const success =
            await tryUseFolder(
                false
            );


        if (!success) {

            folderConnected =
                false;


            setConnectionStatus(
                "برای اتصال دوباره روی 📁 بزنید",
                "error"
            );


            return false;
        }


        folderConnected =
            true;


        setConnectionStatus(
            "متصل: " +
            folderHandle.name,
            "connected"
        );


        await refreshAll();


        return true;

    } catch (error) {

        console.error(
            "tryAutoConnect:",
            error
        );


        folderConnected =
            false;


        setConnectionStatus(
            "برای اتصال دوباره روی 📁 بزنید",
            "error"
        );


        return false;

    } finally {

        connectionChecking =
            false;
    }
}


// ============================================================
// TRY USE FOLDER
//
// askPermission = true
// فقط برای اتصال دستی.
//
// askPermission = false
// برای اتصال خودکار بعد از Refresh.
// ============================================================

async function tryUseFolder(
    askPermission
) {

    if (!folderHandle) {

        return false;
    }


    try {

        // ابتدا مستقیماً فایل را امتحان می‌کنیم.
        //
        // اگر permission از قبل معتبر باشد
        // همین قسمت کافی است.

        const fileHandle =
            await folderHandle.getFileHandle(
                DATA_FILE_NAME
            );


        const file =
            await fileHandle.getFile();


        const text =
            await file.text();


        if (!text.trim()) {

            database =
                createEmptyDatabase();

            await saveDataToFolder();

            return true;
        }


        const parsed =
            JSON.parse(text);


        database =
            normalizeDatabase(
                parsed
            );


        return true;

    } catch (firstError) {

        console.warn(
            "اولین تلاش برای خواندن پوشه:",
            firstError
        );


        // اگر اتصال دستی است، کاربر قبلاً
        // روی دکمه کلیک کرده؛ بنابراین می‌توانیم
        // permission را درخواست کنیم.

        if (
            askPermission &&
            folderHandle &&
            typeof
                folderHandle.requestPermission ===
                "function"
        ) {

            try {

                const permission =
                    await folderHandle
                        .requestPermission({
                            mode: "readwrite"
                        });


                if (
                    permission !==
                    "granted"
                ) {

                    return false;
                }


                const fileHandle =
                    await folderHandle
                        .getFileHandle(
                            DATA_FILE_NAME,
                            {
                                create: true
                            }
                        );


                const file =
                    await fileHandle.getFile();


                const text =
                    await file.text();


                if (!text.trim()) {

                    database =
                        createEmptyDatabase();

                    await saveDataToFolder();

                    return true;
                }


                const parsed =
                    JSON.parse(text);


                database =
                    normalizeDatabase(
                        parsed
                    );


                return true;

            } catch (secondError) {

                console.error(
                    "دسترسی پوشه:",
                    secondError
                );

                return false;
            }
        }


        return false;
    }
}


// ============================================================
// NORMALIZE DATABASE
//
// از خراب شدن ساختار اطلاعات جلوگیری می‌کند.
// ============================================================

function normalizeDatabase(
    parsed
) {

    if (
        !parsed ||
        typeof parsed !==
            "object"
    ) {

        throw new Error(
            "ساختار فایل اطلاعات نامعتبر است."
        );
    }


    return {

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
                "object" &&
            !Array.isArray(
                parsed.inventory
            )
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
                "object" &&
            !Array.isArray(
                parsed.settings
            )
                ? parsed.settings
                : {}

    };
}


// ============================================================
// ENSURE DATA FILE
// ============================================================

async function ensureDataFile() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    try {

        return await folderHandle
            .getFileHandle(
                DATA_FILE_NAME
            );

    } catch (error) {

        if (
            error.name !==
            "NotFoundError"
        ) {

            throw error;
        }


        const fileHandle =
            await folderHandle
                .getFileHandle(
                    DATA_FILE_NAME,
                    {
                        create: true
                    }
                );


        const writable =
            await fileHandle
                .createWritable();


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
}


// ============================================================
// LOAD DATA
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


    const parsed =
        JSON.parse(text);


    database =
        normalizeDatabase(
            parsed
        );
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
// SAVE DATABASE
// ============================================================

async function saveDatabase() {

    try {

        if (
            !folderHandle ||
            !folderConnected
        ) {

            throw new Error(
                "پوشه Bizadshop متصل نیست. اطلاعات تغییر نکرده‌اند."
            );
        }


        await saveDataToFolder();

        return true;

    } catch (error) {

        console.error(
            "saveDatabase:",
            error
        );


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
            String(
                product.barcode
            ).trim() ===
            String(
                barcode
            ).trim()
    );
}


// ============================================================
// INVENTORY
// ============================================================

async function getQuantity(
    productId
) {

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
// SAVE PRODUCT
// ============================================================

async function saveProduct(
    product
) {

    const existing =
        await getProductByBarcode(
            product.barcode
        );


    if (
        existing &&
        existing.id !==
            product.id
    ) {

        throw new Error(
            "این بارکد قبلاً ثبت شده است."
        );
    }


    const index =
        database.products.findIndex(
            item =>
                item.id ===
                product.id
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


    return await saveDatabase();
}


// ============================================================
// PRODUCT FORM
// ============================================================

document
    .getElementById("productForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            try {

                if (
                    !folderConnected
                ) {

                    throw new Error(
                        "ابتدا پوشه Bizadshop را متصل کنید."
                    );
                }


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


                const saved =
                    await saveProduct(
                        product
                    );


                if (!saved) {

                    return;
                }


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
                item.id !==
                productId
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


    const saved =
        await saveDatabase();


    if (!saved) return;


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
                    String(
                        product.name || ""
                    )
                    .toLowerCase()
                    .includes(text)
                    ||
                    String(
                        product.barcode || ""
                    )
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


    products =
        [...products];


    products.sort(
        (a, b) =>
            String(
                b.createdAt || ""
            ).localeCompare(
                String(
                    a.createdAt || ""
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

        } else if (
            quantity <= 5
        ) {

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
                    String(
                        product.name || ""
                    )
                    .toLowerCase()
                    .includes(text)
                    ||
                    String(
                        product.barcode || ""
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


        let stockClass =
            "good";


        if (quantity <= 0) {

            stockClass =
                "empty";

        } else if (
            quantity <= 5
        ) {

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
}


// ============================================================
// STOCK FORM
// ============================================================

document
    .getElementById("stockForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            try {

                if (
                    !folderConnected
                ) {

                    throw new Error(
                        "ابتدا پوشه Bizadshop را متصل کنید."
                    );
                }


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
                    !Number.isFinite(
                        amount
                    ) ||
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


                const saved =
                    await saveDatabase();


                if (!saved) {

                    return;
                }


                closeModal(
                    "stockModal"
                );


                await refreshAll();


                showToast(
                    "موجودی ذخیره شد."
                );

            } catch (error) {

                showToast(
                    error.message ||
                    "ذخیره موجودی ناموفق بود."
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


    await renderCart();
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


    await renderCart();
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
            formatMoney(
                total
            );
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


    if (!folderConnected) {

        showToast(
            "پوشه Bizadshop متصل نیست."
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
        const item of
            lowStock.slice(0, 5)
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
                    String(
                        product.name || ""
                    )
                    .toLowerCase()
                    .includes(text)
                    ||
                    String(
                        product.barcode || ""
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
            pageName +
            "Page"
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

    if (!modal) return;

    modal.classList.add(
        "show"
    );
}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) return;

    modal.classList.remove(
        "show"
    );
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
                            .remove(
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
        .value =
            "0";


    openModal(
        "productModal"
    );
}


// ============================================================
// NAVIGATION EVENTS
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


                    showPage(
                        page
                    );


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


// ============================================================
// FOLDER BUTTON
// ============================================================

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


// ============================================================
// ADD PRODUCT BUTTON
// ============================================================

document
    .getElementById(
        "addProductBtn"
    )
    .addEventListener(
        "click",
        openAddProductModal
    );


// ============================================================
// QUICK ADD
// ============================================================

document
    .getElementById(
        "quickAddProduct"
    )
    .addEventListener(
        "click",
        () => {

            showPage(
                "products"
            );

            openAddProductModal();

        }
    );


// ============================================================
// QUICK SALE
// ============================================================

document
    .getElementById(
        "quickSale"
    )
    .addEventListener(
        "click",
        () => {

            showPage(
                "sale"
            );

            renderCart();

        }
    );


// ============================================================
// PRODUCT SEARCH
// ============================================================

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


// ============================================================
// INVENTORY SEARCH
// ============================================================

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


// ============================================================
// SALE SEARCH
// ============================================================

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


// ============================================================
// CLEAR CART
// ============================================================

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


// ============================================================
// CHECKOUT
// ============================================================

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

                console.error(
                    error
                );

                showToast(
                    error.message ||
                    "ثبت فروش ناموفق بود."
                );
            }

        }
    );


// ============================================================
// LOW STOCK
// ============================================================

document
    .getElementById(
        "showLowStock"
    )
    .addEventListener(
        "click",
        async () => {

            showPage(
                "inventory"
            );

            await renderInventory();

            await renderInventorySummary();

        }
    );


// ============================================================
// BARCODE ENTER
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
// BARCODE SCANNER PLACEHOLDER
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
// REFRESH ALL
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
// RECONNECT ON PAGE VISIBILITY
//
// اگر صفحه دوباره فعال شد، فقط در صورتی که
// اتصال فعلی از بین رفته باشد تلاش می‌کنیم.
//
// هر بار Refresh درخواست انتخاب پوشه نمی‌دهیم.
// ============================================================

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState !==
            "visible"
        ) {

            return;
        }


        if (
            folderConnected
        ) {

            return;
        }


        await tryAutoConnect();
    }
);


// ============================================================
// INITIALIZE
// ============================================================

async function initApp() {

    if (
        !isFolderAPIAvailable()
    ) {

        setConnectionStatus(
            "مرورگر از اتصال مستقیم پوشه پشتیبانی نمی‌کند",
            "error"
        );


        showToast(
            "برای اتصال مستقیم پوشه از Chrome یا مرورگر سازگار استفاده کنید."
        );


        // دیتابیس را عمداً خالی نمی‌کنیم.
        // هیچ داده‌ای از پوشه پاک نمی‌شود.

        return;
    }


    try {

        // مهم:
        //
        // اینجا دیگر database را
        // createEmptyDatabase نمی‌کنیم.
        //
        // اگر اتصال خودکار موفق نشد،
        // اطلاعاتی که قبلاً در حافظه برنامه
        // وجود دارد دستکاری نمی‌شود.

        const connected =
            await tryAutoConnect();


        if (connected) {

            console.log(
                "Bizadshop: اتصال خودکار موفق بود."
            );

        } else {

            console.log(
                "Bizadshop: اتصال خودکار انجام نشد."
            );

        }

    } catch (error) {

        console.error(
            "initApp:",
            error
        );


        setConnectionStatus(
            "برای اتصال دوباره روی 📁 بزنید",
            "error"
        );
    }
}


// ============================================================
// START
// ============================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initApp,
        {
            once: true
        }
    );

} else {

    initApp();
}
