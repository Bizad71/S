/* ============================================================
   Bizadshop
   Persistent Local + Folder Storage Edition

   معماری جدید:

   1. IndexedDB = اطلاعات اصلی برنامه
   2. bizadshop-data.json = فایل پشتیبان/همگام‌سازی پوشه
   3. Folder Handle = فقط مسیر/مجوز پوشه
   4. Refresh هرگز database را صفر نمی‌کند
   5. اگر پوشه موقتاً قابل دسترسی نباشد، برنامه از IndexedDB
      استفاده می‌کند.
   6. کاربر می‌تواند کالا ثبت کند حتی اگر پوشه فعلاً در دسترس
      نباشد.
   7. هنگام اتصال دوباره پوشه، فایل موجود خوانده می‌شود.
   ============================================================ */


/* ============================================================
   CONFIG
   ============================================================ */

const DATA_FILE_NAME = "bizadshop-data.json";

const APP_DB_NAME = "BizadshopAppDB";
const APP_DB_VERSION = 2;

const DATA_STORE = "data";
const HANDLE_STORE = "handles";

const DATA_KEY = "main-data";
const HANDLE_KEY = "main-folder";

let folderHandle = null;

let folderConnected = false;

let folderPermissionGranted = false;

let database = createEmptyDatabase();

let cart = [];

let initialized = false;


/* ============================================================
   DATABASE DEFAULT
   ============================================================ */

function createEmptyDatabase() {

    return {

        version: 2,

        products: [],

        inventory: {},

        sales: [],

        sale_items: [],

        settings: {}

    };
}


/* ============================================================
   BASIC UTILITIES
   ============================================================ */

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

            toast.classList.remove("show");

        }, 2500);
}


function setConnectionStatus(
    text,
    type = ""
) {

    const element =
        document.getElementById(
            "connectionStatus"
        );

    if (!element) return;

    element.textContent = text;

    element.classList.remove(
        "connected",
        "local",
        "error"
    );

    if (type) {

        element.classList.add(
            type
        );
    }
}


/* ============================================================
   NORMALIZE DATABASE
   ============================================================ */

function normalizeDatabase(data) {

    if (
        !data ||
        typeof data !== "object"
    ) {

        return createEmptyDatabase();
    }


    return {

        version:
            data.version || 2,

        products:
            Array.isArray(
                data.products
            )
                ? data.products
                : [],

        inventory:
            data.inventory &&
            typeof data.inventory === "object"
                ? data.inventory
                : {},

        sales:
            Array.isArray(
                data.sales
            )
                ? data.sales
                : [],

        sale_items:
            Array.isArray(
                data.sale_items
            )
                ? data.sale_items
                : [],

        settings:
            data.settings &&
            typeof data.settings === "object"
                ? data.settings
                : {}

    };
}


/* ============================================================
   INDEXEDDB
   ============================================================ */

function openAppDB() {

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
                    APP_DB_NAME,
                    APP_DB_VERSION
                );


            request.onupgradeneeded =
                event => {

                    const db =
                        event.target.result;


                    if (
                        !db.objectStoreNames
                            .contains(DATA_STORE)
                    ) {

                        db.createObjectStore(
                            DATA_STORE
                        );
                    }


                    if (
                        !db.objectStoreNames
                            .contains(HANDLE_STORE)
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
                        request.error
                    );

                };

        }
    );
}


/* ============================================================
   SAVE LOCAL DATABASE
   ============================================================ */

async function saveLocalDatabase() {

    const db =
        await openAppDB();


    return new Promise(
        (resolve, reject) => {

            const tx =
                db.transaction(
                    DATA_STORE,
                    "readwrite"
                );


            tx.objectStore(
                DATA_STORE
            ).put(
                database,
                DATA_KEY
            );


            tx.oncomplete =
                () => {

                    db.close();

                    resolve(true);

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


/* ============================================================
   LOAD LOCAL DATABASE
   ============================================================ */

async function loadLocalDatabase() {

    const db =
        await openAppDB();


    return new Promise(
        (resolve, reject) => {

            const tx =
                db.transaction(
                    DATA_STORE,
                    "readonly"
                );


            const request =
                tx.objectStore(
                    DATA_STORE
                ).get(
                    DATA_KEY
                );


            request.onsuccess =
                () => {

                    db.close();

                    if (
                        request.result
                    ) {

                        database =
                            normalizeDatabase(
                                request.result
                            );

                    } else {

                        database =
                            createEmptyDatabase();

                    }


                    resolve(
                        database
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


/* ============================================================
   SAVE FOLDER HANDLE
   ============================================================ */

async function saveFolderHandle(
    handle
) {

    const db =
        await openAppDB();


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

                    resolve(true);

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


/* ============================================================
   GET FOLDER HANDLE
   ============================================================ */

async function getFolderHandle() {

    const db =
        await openAppDB();


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


/* ============================================================
   DELETE HANDLE
   ============================================================ */

async function deleteFolderHandle() {

    const db =
        await openAppDB();


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

                    resolve(true);

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


/* ============================================================
   PERMISSION
   ============================================================ */

async function getFolderPermission(
    handle
) {

    if (!handle) {

        return "denied";
    }


    try {

        if (
            typeof handle.queryPermission !==
            "function"
        ) {

            return "denied";
        }


        return await handle.queryPermission({
            mode: "readwrite"
        });

    } catch (error) {

        console.error(
            "queryPermission:",
            error
        );

        return "denied";
    }
}


/* ============================================================
   REQUEST PERMISSION
   فقط در اثر کلیک کاربر
   ============================================================ */

async function requestFolderPermission(
    handle
) {

    if (!handle) {

        return false;
    }


    try {

        const current =
            await getFolderPermission(
                handle
            );


        if (
            current === "granted"
        ) {

            return true;
        }


        if (
            typeof handle.requestPermission !==
            "function"
        ) {

            return false;
        }


        const result =
            await handle.requestPermission({
                mode: "readwrite"
            });


        return result === "granted";

    } catch (error) {

        console.error(
            "requestPermission:",
            error
        );

        return false;
    }
}


/* ============================================================
   READ FILE FROM FOLDER
   ============================================================ */

async function readFolderData() {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    const fileHandle =
        await folderHandle.getFileHandle(
            DATA_FILE_NAME
        );


    const file =
        await fileHandle.getFile();


    const text =
        await file.text();


    if (!text.trim()) {

        return null;
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


    return normalizeDatabase(
        parsed
    );
}


/* ============================================================
   WRITE DATA TO FOLDER
   ============================================================ */

async function writeDataToFolder(
    data = database
) {

    if (!folderHandle) {

        throw new Error(
            "پوشه متصل نیست."
        );
    }


    const permission =
        await getFolderPermission(
            folderHandle
        );


    if (
        permission !== "granted"
    ) {

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
            data,
            null,
            2
        )
    );


    await writable.close();


    return true;
}


/* ============================================================
   CHECK IF DATABASE HAS REAL DATA
   ============================================================ */

function hasRealData(
    data
) {

    if (!data) return false;


    return (
        data.products.length > 0 ||
        data.sales.length > 0 ||
        data.sale_items.length > 0 ||
        Object.keys(
            data.inventory || {}
        ).length > 0
    );
}


/* ============================================================
   FOLDER CONNECTION
   ============================================================ */

async function connectSelectedFolder(
    handle
) {

    if (!handle) {

        return false;
    }


    folderHandle =
        handle;


    const permission =
        await getFolderPermission(
            folderHandle
        );


    if (
        permission !== "granted"
    ) {

        const requested =
            await requestFolderPermission(
                folderHandle
            );


        if (!requested) {

            folderConnected = false;

            folderPermissionGranted = false;

            setConnectionStatus(
                "اطلاعات محلی فعال است؛ پوشه نیاز به اجازه دارد",
                "local"
            );

            return false;
        }
    }


    folderPermissionGranted =
        true;


    try {

        let folderData = null;


        try {

            folderData =
                await readFolderData();

        } catch (error) {

            /*
             فایل وجود ندارد.
             در این حالت اطلاعات فعلی برنامه
             را داخل فایل ایجاد می‌کنیم.
            */

            if (
                error.name ===
                "NotFoundError"
            ) {

                folderData = null;

            } else {

                throw error;
            }
        }


        /*
         اگر فایل پوشه اطلاعات دارد،
         همان اطلاعات قبلی فروشگاه را برمی‌گردانیم.
        */

        if (
            folderData &&
            hasRealData(folderData)
        ) {

            database =
                normalizeDatabase(
                    folderData
                );


            await saveLocalDatabase();

        } else {

            /*
             اگر فایل خالی/جدید است،
             اطلاعات فعلی IndexedDB را داخل آن می‌نویسیم.
            */

            await writeDataToFolder(
                database
            );
        }


        folderConnected = true;


        setConnectionStatus(
            "متصل به پوشه: " +
            folderHandle.name,
            "connected"
        );


        await refreshAll();


        return true;

    } catch (error) {

        console.error(
            "connectSelectedFolder:",
            error
        );


        folderConnected = false;


        setConnectionStatus(
            "اطلاعات محلی فعال است؛ خطا در خواندن پوشه",
            "local"
        );


        return false;
    }
}


/* ============================================================
   CHOOSE FOLDER
   این تابع فقط با کلیک کاربر اجرا می‌شود.
   ============================================================ */

async function chooseFolder() {

    if (
        !("showDirectoryPicker" in window)
    ) {

        showToast(
            "این مرورگر از اتصال مستقیم به پوشه پشتیبانی نمی‌کند."
        );

        setConnectionStatus(
            "حالت محلی فعال است",
            "local"
        );

        return false;
    }


    try {

        const handle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });


        /*
         این handle ذخیره می‌شود تا در Refresh
         دوباره بتوانیم آن را پیدا کنیم.
        */

        await saveFolderHandle(
            handle
        );


        folderHandle =
            handle;


        const connected =
            await connectSelectedFolder(
                handle
            );


        if (connected) {

            showToast(
                "پوشه Bizadshop با موفقیت متصل شد."
            );

        }


        return connected;

    } catch (error) {

        console.error(
            "chooseFolder:",
            error
        );


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


/* ============================================================
   AUTO CONNECT
   مهم:
   این تابع هرگز requestPermission را خودکار اجرا نمی‌کند.
   بنابراین Refresh روی گوشی گیر نمی‌کند.
   ============================================================ */

async function tryAutoConnect() {

    try {

        const handle =
            await getFolderHandle();


        if (!handle) {

            folderConnected = false;

            folderPermissionGranted = false;

            setConnectionStatus(
                "حالت محلی فعال است",
                "local"
            );

            return false;
        }


        folderHandle =
            handle;


        const permission =
            await getFolderPermission(
                folderHandle
            );


        /*
         اگر مرورگر مجوز را حفظ کرده باشد،
         بدون هیچ دخالت کاربر وصل می‌شویم.
        */

        if (
            permission === "granted"
        ) {

            folderPermissionGranted =
                true;


            try {

                const folderData =
                    await readFolderData();


                if (
                    folderData &&
                    hasRealData(folderData)
                ) {

                    database =
                        normalizeDatabase(
                            folderData
                        );


                    await saveLocalDatabase();

                } else {

                    /*
                     فایل وجود دارد ولی خالی است.
                     اطلاعات IndexedDB را از بین نمی‌بریم.
                    */

                    await writeDataToFolder(
                        database
                    );
                }


                folderConnected = true;


                setConnectionStatus(
                    "متصل به پوشه: " +
                    folderHandle.name,
                    "connected"
                );


                return true;

            } catch (error) {

                console.error(
                    "Auto folder read:",
                    error
                );


                folderConnected = false;


                setConnectionStatus(
                    "اطلاعات محلی فعال است؛ پوشه فعلاً در دسترس نیست",
                    "local"
                );


                return false;
            }
        }


        /*
         permission = prompt یا denied

         اینجا عمداً requestPermission نمی‌زنیم.
         چون Refresh نباید پنجره اجازه باز کند.
        */

        folderConnected = false;

        folderPermissionGranted = false;


        setConnectionStatus(
            "اطلاعات محلی فعال است؛ پوشه نیاز به اجازه دارد",
            "local"
        );


        return false;

    } catch (error) {

        console.error(
            "tryAutoConnect:",
            error
        );


        folderHandle = null;

        folderConnected = false;

        folderPermissionGranted = false;


        setConnectionStatus(
            "اطلاعات محلی فعال است",
            "local"
        );


        return false;
    }
}


/* ============================================================
   MANUAL RECONNECT EXISTING FOLDER
   ============================================================ */

async function reconnectExistingFolder() {

    if (!folderHandle) {

        return chooseFolder();
    }


    const granted =
        await requestFolderPermission(
            folderHandle
        );


    if (!granted) {

        setConnectionStatus(
            "اطلاعات محلی فعال است؛ اجازه پوشه داده نشد",
            "local"
        );

        return false;
    }


    folderPermissionGranted =
        true;


    try {

        const folderData =
            await readFolderData();


        if (
            folderData &&
            hasRealData(folderData)
        ) {

            database =
                normalizeDatabase(
                    folderData
                );


            await saveLocalDatabase();

        } else {

            await writeDataToFolder(
                database
            );
        }


        folderConnected = true;


        setConnectionStatus(
            "متصل به پوشه: " +
            folderHandle.name,
            "connected"
        );


        await refreshAll();


        showToast(
            "اطلاعات پوشه بازیابی شد."
        );


        return true;

    } catch (error) {

        console.error(
            "reconnect:",
            error
        );


        folderConnected = false;


        setConnectionStatus(
            "اطلاعات محلی فعال است",
            "local"
        );


        showToast(
            "خواندن اطلاعات پوشه ناموفق بود."
        );


        return false;
    }
}


/* ============================================================
   SAVE EVERYTHING
   اول IndexedDB
   بعد اگر پوشه در دسترس بود JSON
   ============================================================ */

async function saveDatabase() {

    try {

        /*
         مهم:
         همیشه اول اطلاعات را داخل IndexedDB ذخیره می‌کنیم.
         */

        await saveLocalDatabase();


        /*
         سپس اگر پوشه قابل نوشتن است،
         همان اطلاعات را در فایل JSON ذخیره می‌کنیم.
        */

        if (
            folderHandle &&
            folderPermissionGranted
        ) {

            try {

                await writeDataToFolder(
                    database
                );


                folderConnected = true;


                setConnectionStatus(
                    "متصل به پوشه: " +
                    folderHandle.name,
                    "connected"
                );


            } catch (folderError) {

                console.error(
                    "Folder save:",
                    folderError
                );


                folderConnected = false;


                setConnectionStatus(
                    "در حافظه گوشی ذخیره شد؛ پوشه فعلاً در دسترس نیست",
                    "local"
                );
            }
        }


        return true;

    } catch (error) {

        console.error(
            "saveDatabase:",
            error
        );


        showToast(
            "ذخیره اطلاعات ناموفق بود."
        );


        return false;
    }
}


/* ============================================================
   PRODUCTS
   ============================================================ */

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


/* ============================================================
   INVENTORY
   ============================================================ */

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


/* ============================================================
   PRODUCT SAVE
   ============================================================ */

async function saveProduct(
    product
) {

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
            "ذخیره کالا ناموفق بود."
        );
    }


    return product;
}


/* ============================================================
   PRODUCT FORM
   ============================================================ */

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

                console.error(error);

                showToast(
                    error.message ||
                    "ذخیره کالا ناموفق بود."
                );
            }

        }
    );


/* ============================================================
   EDIT PRODUCT
   ============================================================ */

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
        "product
