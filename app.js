// ============================================================
// Bizadshop
// Permanent Folder Connection Edition
//
// اطلاعات اصلی فروشگاه:
// Bizadshop/bizadshop-data.json
//
// IndexedDB:
// فقط برای نگه داشتن Folder Handle
//
// LocalStorage:
// فقط یک Snapshot موقت برای جلوگیری از صفر شدن صفحه
// در صورت از دست رفتن موقت مجوز مرورگر موبایل.
//
// نکته:
// اطلاعات اصلی همچنان داخل bizadshop-data.json است.
// ============================================================


const DATA_FILE_NAME = "bizadshop-data.json";

const HANDLE_DB_NAME = "BizadshopFolderDB";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_KEY = "main-folder";

const CACHE_KEY = "BizadshopLastKnownData";

let folderHandle = null;

let database = createEmptyDatabase();

let cart = [];

let connectionState = "unknown";

let saveLock = Promise.resolve();


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

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 2800);
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

    element.textContent = text;

    element.classList.remove(
        "connected",
        "warning",
        "error"
    );

    if (state) {

        element.classList.add(
            state
        );
    }
}


// ============================================================
// DATABASE
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


function normalizeDatabase(data) {

    const source =
        data &&
        typeof data === "object"
            ? data
            : {};


    return {

        version:
            source.version || 1,

        products:
            Array.isArray(
                source.products
            )
                ? source.products
                : [],

        inventory:
            source.inventory &&
            typeof source.inventory === "object"
                ? source.inventory
                : {},

        sales:
            Array.isArray(
                source.sales
            )
                ? source.sales
                : [],

        sale_items:
            Array.isArray(
                source.sale_items
            )
                ? source.sale_items
                : [],

        settings:
            source.settings &&
            typeof source.settings === "object"
                ? source.settings
                : {}

    };
}


function databaseHasData(data = database) {

    return (
        Array.isArray(data.products) &&
        data.products.length > 0
    ) ||
    (
        Array.isArray(data.sales) &&
        data.sales.length > 0
    ) ||
    (
        data.inventory &&
        Object.keys(data.inventory).length > 0
    );
}


// ============================================================
// LOCAL SNAPSHOT
//
// این فقط برای این است که اگر موبایل موقتاً مجوز پوشه را
// بعد از Refresh نداد، صفحه صفر نشود.
// فایل اصلی همچنان bizadshop-data.json است.
// ============================================================

function saveLocalSnapshot() {

    try {

        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify(database)
        );

    } catch (error) {

        console.warn(
            "Could not save local snapshot.",
            error
        );
    }
}


function loadLocalSnapshot() {

    try {

        const text =
            localStorage.getItem(
                CACHE_KEY
            );


        if (!text) {
            return null;
        }


        const parsed =
            JSON.parse(text);


        if (!parsed) {
            return null;
        }


        return normalizeDatabase(
            parsed
        );

    } catch (error) {

        console.warn(
            "Could not load local snapshot.",
            error
        );

        return null;
    }
}


// ============================================================
// HANDLE DATABASE
// ============================================================

function openHandleDB() {

    return new Promise(
        (resolve, reject) => {

            if (!("indexedDB" in window)) {

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
                function(event) {

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
                function() {

                    resolve(
                        request.result
                    );
                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );
                };

        }
    );
}


async function saveFolderHandle(handle) {

    if (!handle) return;

    const db =
        await openHandleDB();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    HANDLE_STORE,
                    "readwrite"
                );


            transaction
                .objectStore(
                    HANDLE_STORE
                )
                .put(
                    handle,
                    HANDLE_KEY
                );


            transaction.oncomplete =
                function() {

                    db.close();

                    resolve();
                };


            transaction.onerror =
                function() {

                    db.close();

                    reject(
                        transaction.error
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

            const transaction =
                db.transaction(
                    HANDLE_STORE,
                    "readonly"
                );


            const request =
                transaction
                    .objectStore(
                        HANDLE_STORE
                    )
                    .get(
                        HANDLE_KEY
                    );


            request.onsuccess =
                function() {

                    db.close();

                    resolve(
                        request.result ||
                        null
                    );
                };


            request.onerror =
                function() {

                    db.close();

                    reject(
                        request.error
                    );
                };

        }
    );
}


async function deleteFolderHandle() {

    try {

        const db =
            await openHandleDB();


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    db.transaction(
                        HANDLE_STORE,
                        "readwrite"
                    );


                transaction
                    .objectStore(
                        HANDLE_STORE
                    )
                    .delete(
                        HANDLE_KEY
                    );


                transaction.oncomplete =
                    function() {

                        db.close();

                        resolve();
                    };


                transaction.onerror =
                    function() {

                        db.close();

                        reject(
                            transaction.error
                        );
                    };

            }
        );

    } catch (error) {

        console.warn(error);

    }
}


// ============================================================
// PERMISSION
// ============================================================

async function getPermissionState(handle) {

    if (!handle) {
        return "denied";
    }


    try {

        if (
            typeof handle.queryPermission !==
            "function"
        ) {

            return "unknown";
        }


        return await handle.queryPermission({
            mode: "readwrite"
        });

    } catch (error) {

        console.warn(
            "Permission query failed:",
            error
        );

        return "unknown";
    }
}


async function hasReadWritePermission(handle) {

    const permission =
        await getPermissionState(
            handle
        );


    return permission === "granted";
}


// ============================================================
// FILE ACCESS
// ============================================================

async function getExistingDataFileHandle() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    try {

        return await folderHandle.getFileHandle(
            DATA_FILE_NAME
        );

    } catch (error) {

        if (
            error.name ===
            "NotFoundError"
        ) {

            return null;
        }


        throw error;
    }
}


async function ensureDataFile() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    const existing =
        await getExistingDataFileHandle();


    if (existing) {

        return existing;
    }


    // فقط در صورتی فایل جدید می‌سازیم که واقعاً
    // فایل قبلی وجود نداشته باشد.

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
            createEmptyDatabase(),
            null,
            2
        )
    );


    await writable.close();


    return fileHandle;
}


// ============================================================
// READ DATA FROM FOLDER
// ============================================================

async function loadDataFromFolder() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    const permission =
        await getPermissionState(
            folderHandle
        );


    if (
        permission !== "granted"
    ) {

        throw new Error(
            "اجازه خواندن پوشه در دسترس نیست."
        );
    }


    const existingFile =
        await getExistingDataFileHandle();


    // اگر فایل قبلی وجود دارد،
    // حتماً همان فایل را می‌خوانیم.

    if (existingFile) {

        const file =
            await existingFile.getFile();


        const text =
            await file.text();


        if (!text.trim()) {

            // فایل خالی را هرگز به عنوان دیتابیس
            // جدید روی اطلاعات قبلی تحمیل نمی‌کنیم.

            const local =
                loadLocalSnapshot();


            if (
                local &&
                databaseHasData(local)
            ) {

                database = local;

                saveLocalSnapshot();

                throw new Error(
                    "فایل اطلاعات فروشگاه خالی است؛ اطلاعات قبلی از حافظه موقت نمایش داده شد."
                );
            }


            database =
                createEmptyDatabase();


            saveLocalSnapshot();

            return true;
        }


        let parsed;


        try {

            parsed =
                JSON.parse(text);

        } catch (error) {

            const local =
                loadLocalSnapshot();


            if (
                local &&
                databaseHasData(local)
            ) {

                database = local;

                throw new Error(
                    "فایل اصلی خراب است؛ اطلاعات آخرین نسخه نمایش داده شد."
                );
            }


            throw new Error(
                "فایل bizadshop-data.json خراب یا نامعتبر است."
            );
        }


        database =
            normalizeDatabase(
                parsed
            );


        // بعد از خواندن موفق فایل اصلی،
        // Snapshot را هم به‌روز می‌کنیم.

        saveLocalSnapshot();


        return true;
    }


    // فایل واقعاً وجود ندارد.
    // فقط در این حالت فایل جدید می‌سازیم.

    const newFile =
        await ensureDataFile();


    const file =
        await newFile.getFile();


    const text =
        await file.text();


    if (text.trim()) {

        try {

            database =
                normalizeDatabase(
                    JSON.parse(text)
                );

        } catch (error) {

            throw new Error(
                "فایل جدید اطلاعات نامعتبر دارد."
            );
        }

    } else {

        database =
            createEmptyDatabase();
    }


    saveLocalSnapshot();


    return true;
}


// ============================================================
// WRITE DATA TO FOLDER
// ============================================================

async function writeDatabaseToFolder() {

    if (!folderHandle) {

        throw new Error(
            "پوشه Bizadshop متصل نیست."
        );
    }


    const permission =
        await getPermissionState(
            folderHandle
        );


    if (
        permission !== "granted"
    ) {

        throw new Error(
            "اجازه نوشتن به پوشه وجود ندارد."
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
// SAFE SAVE
//
// جلوگیری از هم‌زمان شدن چند عملیات ذخیره.
// ============================================================

function saveDatabase() {

    saveLock =
        saveLock.then(
            async () => {

                saveLocalSnapshot();


                if (!folderHandle) {

                    throw new Error(
                        "پوشه Bizadshop متصل نیست."
                    );
                }


                await writeDatabaseToFolder();

            }
        );


    return saveLock
        .then(
            () => {

                setConnectionStatus(
                    "متصل و ذخیره شده",
                    "connected"
                );

                return true;
            }
        )
        .catch(
            error => {

                console.error(
                    error
                );


                setConnectionStatus(
                    "اتصال برای ذخیره نیاز به بررسی دارد",
                    "warning"
                );


                showToast(
                    error.message ||
                    "ذخیره اطلاعات ناموفق بود."
                );


                return false;
            }
        );
}


// ============================================================
// CONNECT SELECTED FOLDER
// ============================================================

async function chooseFolder() {

    if (
        !("showDirectoryPicker" in window)
    ) {

        setConnectionStatus(
            "مرورگر از اتصال پوشه پشتیبانی نمی‌کند",
            "error"
        );


        showToast(
            "برای اتصال مستقیم به پوشه از Chrome یا مرورگر سازگار استفاده کنید."
        );


        return false;
    }


    try {

        setConnectionStatus(
            "در حال اتصال به پوشه...",
            "warning"
        );


        const selectedHandle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });


        // ابتدا Handle جدید را بررسی می‌کنیم.

        const permission =
            await getPermissionState(
                selectedHandle
            );


        if (
            permission !== "granted"
        ) {

            const requested =
                await selectedHandle.requestPermission({
                    mode: "readwrite"
                });


            if (
                requested !== "granted"
            ) {

                setConnectionStatus(
                    "اجازه پوشه داده نشد",
                    "error"
                );


                showToast(
                    "اجازه دسترسی به پوشه داده نشد."
                );


                return false;
            }
        }


        folderHandle =
            selectedHandle;


        // Handle را برای Refresh بعدی نگه می‌داریم.

        await saveFolderHandle(
            folderHandle
        );


        // بسیار مهم:
        // اول فایل قبلی را می‌خوانیم.
        // هیچ‌وقت قبل از خواندن فایل، دیتابیس را صفر نمی‌کنیم.

        await loadDataFromFolder();


        setConnectionStatus(
            "متصل به پوشه: " +
            folderHandle.name,
            "connected"
        );


        await refreshAll();


        showToast(
            "پوشه متصل شد و اطلاعات قبلی بازیابی شد."
        );


        return true;

    } catch (error) {

        console.error(
            "Folder selection error:",
            error
        );


        if (
            error.name ===
            "AbortError"
        ) {

            const cached =
                loadLocalSnapshot();


            if (
                cached &&
                databaseHasData(cached)
            ) {

                database = cached;

                await refreshAll();
            }


            return false;
        }


        setConnectionStatus(
            "اتصال ناموفق بود",
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
// مهم‌ترین بخش برای Refresh.
// ============================================================

async function tryAutoConnect() {

    setConnectionStatus(
        "در حال بررسی اتصال پوشه...",
        "warning"
    );


    // اول Snapshot را می‌خوانیم.
    // این باعث می‌شود صفحه در گوشی هیچ‌وقت بی‌دلیل صفر نشود.

    const cached =
        loadLocalSnapshot();


    if (
        cached &&
        databaseHasData(cached)
    ) {

        database =
            cached;


        await refreshAll();
    }


    let savedHandle = null;


    try {

        savedHandle =
            await getFolderHandle();

    } catch (error) {

        console.warn(
            "Could not read saved folder handle:",
            error
        );
    }


    if (!savedHandle) {

        if (
            cached &&
            databaseHasData(cached)
        ) {

            setConnectionStatus(
                "اطلاعات قبلی موجود است؛ اتصال پوشه نیاز به تأیید دارد",
                "warning"
            );

        } else {

            setConnectionStatus(
                "پوشه هنوز متصل نشده است",
                "warning"
            );
        }


        return false;
    }


    folderHandle =
        savedHandle;


    try {

        const permission =
            await getPermissionState(
                folderHandle
            );


        // حالت ایده‌آل:
        // مرورگر اجازه را نگه داشته است.

        if (
            permission === "granted"
        ) {

            await loadDataFromFolder();


            setConnectionStatus(
                "متصل به پوشه: " +
                folderHandle.name,
                "connected"
            );


            await refreshAll();


            return true;
        }


        // در موبایل ممکن است Handle وجود داشته باشد
        // ولی queryPermission دوباره granted نباشد.
        //
        // اینجا اطلاعات را صفر نمی‌کنیم.

        if (
            cached &&
            databaseHasData(cached)
        ) {

            database =
                cached;


            await refreshAll();


            setConnectionStatus(
                "اطلاعات محفوظ است؛ تأیید پوشه لازم است",
                "warning"
            );


            return false;
        }


        setConnectionStatus(
            "برای اتصال دوباره روی 📁 بزنید",
            "warning"
        );


        return false;

    } catch (error) {

        console.error(
            "Auto connection failed:",
            error
        );


        // هرگز اینجا database را خالی نمی‌کنیم.

        if (
            cached &&
            databaseHasData(cached)
        ) {

            database =
                cached;


            await refreshAll();


            setConnectionStatus(
                "اطلاعات محفوظ است؛ اتصال پوشه نیاز به تأیید دارد",
                "warning"
            );

        } else {

            setConnectionStatus(
                "برای اتصال پوشه روی 📁 بزنید",
                "warning"
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


    const saved =
        await saveDatabase();


    if (!saved) {

        throw new Error(
            "کالا ذخیره نشد."
        );
    }


    return product;
}


// ============================================================
// PRODUCT FORM
// ============================================================

document
    .getElementById("productForm")
    .addEventListener(
        "submit",
        async function(event) {

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


    const oldProducts =
        database.products;


    const oldInventory =
        database.inventory;


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


    const saved =
        await saveDatabase();


    if (!saved) {

        database.products =
            oldProducts;

        database.inventory =
            oldInventory;

        return;
    }


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
        String(search || "")
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
        [...products].sort(
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


        if (
            quantity <= 0
        ) {

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
        String(search || "")
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


        if (
            quantity <= 0
        ) {

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
        async function(event) {

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


                if (!saved) return;


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


    if (
        quantity <= 0
    ) {

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


    if (
        newQuantity <= 0
    ) {

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
// CART RENDER
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
        const item of lowStock.slice(
            0,
            5
        )
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
            .slice(
                0,
                10
            );


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


    if (modal) {

        modal.classList.add(
            "show"
        );
    }
}


function closeModal(id) {

    const modal =
        document.getElementById(id);


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

            showPage(
                "products"
            );

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

            showPage(
                "sale"
            );

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
// PAGE VISIBILITY
//
// وقتی کاربر از برنامه خارج/وارد می‌شود یا گوشی تب را
// دوباره فعال می‌کند، دوباره Handle را بررسی می‌کنیم.
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


        if (!folderHandle) {

            return;
        }


        try {

            const permission =
                await getPermissionState(
                    folderHandle
                );


            if (
                permission === "granted"
            ) {

                await loadDataFromFolder();


                setConnectionStatus(
                    "متصل به پوشه: " +
                    folderHandle.name,
                    "connected"
                );


                await refreshAll();
            }

        } catch (error) {

            console.warn(
                "Visibility reconnect failed:",
                error
            );
        }

    }
);


// ============================================================
// INITIALIZE
// ============================================================

async function initApp() {

    try {

        // اول Snapshot را نمایش می‌دهیم.
        // بنابراین صفحه در گوشی با صفر شروع نمی‌شود.

        const cached =
            loadLocalSnapshot();


        if (
            cached &&
            databaseHasData(cached)
        ) {

            database =
                cached;


            await refreshAll();
        }


        if (
            !("showDirectoryPicker" in window)
        ) {

            setConnectionStatus(
                "مرورگر از اتصال پوشه پشتیبانی نمی‌کند",
                "error"
            );


            if (
                !cached ||
                !databaseHasData(cached)
            ) {

                await refreshAll();
            }


            showToast(
                "برای اتصال مستقیم به پوشه از Chrome یا مرورگر سازگار استفاده کنید."
            );


            return;
        }


        // تلاش برای اتصال خودکار.

        const connected =
            await tryAutoConnect();


        if (!connected) {

            // بسیار مهم:
            // اینجا database را createEmptyDatabase نمی‌کنیم.
            // اطلاعات قبلی نباید صفر شود.

            const currentData =
                loadLocalSnapshot();


            if (
                currentData &&
                databaseHasData(
                    currentData
                )
            ) {

                database =
                    currentData;


                await refreshAll();


                setConnectionStatus(
                    "اطلاعات محفوظ است؛ برای دسترسی کامل روی 📁 بزنید",
                    "warning"
                );

            } else {

                await refreshAll();


                setConnectionStatus(
                    "برای اتصال پوشه روی 📁 بزنید",
                    "warning"
                );
            }
        }


        console.log(
            "Bizadshop آماده است."
        );


    } catch (error) {

        console.error(
            "Bizadshop initialization error:",
            error
        );


        // حتی در خطای راه‌اندازی هم اطلاعات را صفر نمی‌کنیم.

        const cached =
            loadLocalSnapshot();


        if (
            cached &&
            databaseHasData(cached)
        ) {

            database =
                cached;


            await refreshAll();


            setConnectionStatus(
                "اطلاعات محفوظ است؛ اتصال پوشه نیاز به بررسی دارد",
                "warning"
            );

        } else {

            await refreshAll();


            setConnectionStatus(
                "برای اتصال پوشه روی 📁 بزنید",
                "warning"
            );
        }
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
        initApp
    );

} else {

    initApp();
}
