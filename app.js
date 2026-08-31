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
        "productModal"
    );
}


/* ============================================================
   DELETE PRODUCT
   ============================================================ */

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


/* ============================================================
   PRODUCTS LIST
   ============================================================ */

async function renderProducts(
    search = ""
) {

    const container =
        document.getElementById(
            "productsList"
        );


    if (!container) return;


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


/* ============================================================
   INVENTORY LIST
   ============================================================ */

async function renderInventory(
    search = ""
) {

    const container =
        document.getElementById(
            "inventoryList"
        );


    if (!container) return;


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


/* ============================================================
   STOCK MODAL
   ============================================================ */

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


/* ============================================================
   STOCK FORM
   ============================================================ */

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


                const saved =
                    await saveDatabase();


                if (!saved) {

                    throw new Error(
                        "ذخیره موجودی ناموفق بود."
                    );
                }


                closeModal(
                    "stockModal"
                );


                await refreshAll();


                showToast(
                    "موجودی ذخیره شد."
                );

            } catch (error) {

                console.error(error);

                showToast(
                    error.message
                );
            }

        }
    );


/* ============================================================
   SALES / CART
   ============================================================ */

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


/* ============================================================
   CART
   ============================================================ */

async function renderCart() {

    const container =
        document.getElementById(
            "cartList"
        );


    if (!container) return;


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
            formatMoney(total);
}


/* ============================================================
   CHECKOUT
   ============================================================ */

async function checkout() {

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


    if (!saved) {

        throw new Error(
            "ثبت فروش ناموفق بود."
        );
    }


    cart = [];


    await refreshAll();


    showToast(
        "فروش با موفقیت ذخیره شد."
    );
}


/* ============================================================
   TODAY SALES
   ============================================================ */

function isToday(
    isoDate
) {

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


async function getTodaySales() {

    return database.sales.filter(
        sale =>
            isToday(
                sale.createdAt
            )
    );
}


/* ============================================================
   DASHBOARD
   ============================================================ */

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


/* ============================================================
   LOW STOCK
   ============================================================ */

async function renderLowStock() {

    const container =
        document.getElementById(
            "lowStockList"
        );


    if (!container) return;


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


/* ============================================================
   INVENTORY SUMMARY
   ============================================================ */

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


/* ============================================================
   SALE SEARCH
   ============================================================ */

async function renderSaleSearch(
    text
) {

    const container =
        document.getElementById(
            "saleSearchResults"
        );


    if (!container) return;


    text =
        String(
            text || ""
        )
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


/* ============================================================
   NAVIGATION
   ============================================================ */

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


/* ============================================================
   MODALS
   ============================================================ */

function openModal(id) {

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


function closeModal(id) {

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


/* ============================================================
   MODAL EVENTS
   ============================================================ */

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


/* ============================================================
   ADD PRODUCT
   ============================================================ */

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


/* ============================================================
   EVENT LISTENERS
   ============================================================ */

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


/* ============================================================
   FOLDER BUTTON
   ============================================================ */

document
    .getElementById(
        "settingsBtn"
    )
    .addEventListener(
        "click",
        async () => {

            /*
             اگر handle قبلی داریم،
             اول تلاش می‌کنیم همان پوشه را دوباره
             با اجازه‌ای که فقط با کلیک کاربر درخواست
             می‌شود فعال کنیم.
            */

            if (folderHandle) {

                const reconnected =
                    await reconnectExistingFolder();


                if (reconnected) {

                    return;
                }
            }


            /*
             اگر handle قبلی قابل استفاده نبود،
             انتخاب پوشه جدید.
            */

            await chooseFolder();

        }
    );


/* ============================================================
   ADD PRODUCT BUTTON
   ============================================================ */

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


/* ============================================================
   QUICK SALE
   ============================================================ */

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


/* ============================================================
   SEARCH
   ============================================================ */

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


/* ============================================================
   CLEAR CART
   ============================================================ */

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


/* ============================================================
   CHECKOUT
   ============================================================ */

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

                console.error(error);

                showToast(
                    error.message ||
                    "ثبت فروش ناموفق بود."
                );
            }

        }
    );


/* ============================================================
   LOW STOCK
   ============================================================ */

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


/* ============================================================
   BARCODE ENTER
   ============================================================ */

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


/* ============================================================
   BARCODE SCANNER
   ============================================================ */

let barcodeStream = null;
let barcodeScanTimer = null;
let barcodeScannerTarget = "sale";
let barcodeScannerBusy = false;

function getBarcodeInput(target) {
    return document.getElementById(target === "product" ? "productBarcode" : "saleSearch");
}

function closeBarcodeScanner() {
    const modal = document.getElementById("barcodeScannerModal");
    const video = document.getElementById("barcodeVideo");

    if (barcodeScanTimer) {
        clearTimeout(barcodeScanTimer);
        barcodeScanTimer = null;
    }

    if (barcodeStream) {
        barcodeStream.getTracks().forEach(track => track.stop());
        barcodeStream = null;
    }

    if (video) {
        video.pause();
        video.srcObject = null;
    }

    barcodeScannerBusy = false;

    if (modal) {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
    }
}

async function startBarcodeScanner(target = "sale") {
    const modal = document.getElementById("barcodeScannerModal");
    const video = document.getElementById("barcodeVideo");
    const status = document.getElementById("barcodeScannerStatus");

    barcodeScannerTarget = target;
    if (!modal || !video || !status) return;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    status.textContent = "در حال باز کردن دوربین...";

    if (!navigator.mediaDevices?.getUserMedia) {
        status.textContent = "دوربین این مرورگر در دسترس نیست. بارکد را دستی وارد کنید.";
        return;
    }

    if (!("BarcodeDetector" in window)) {
        status.textContent = "اسکن خودکار در این مرورگر پشتیبانی نمی‌شود؛ بارکد را دستی وارد کنید.";
        return;
    }

    try {
        barcodeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });

        video.srcObject = barcodeStream;
        await video.play();

        const detector = new BarcodeDetector();
        barcodeScannerBusy = false;
        status.textContent = "دوربین آماده است؛ بارکد را روبه‌روی دوربین بگیرید.";

        const scan = async () => {
            if (!barcodeScannerBusy && video.readyState >= 2) {
                try {
                    const codes = await detector.detect(video);
                    if (codes.length) {
                        const value = String(codes[0].rawValue || "").trim();
                        if (value) {
                            barcodeScannerBusy = true;
                            const input = getBarcodeInput(barcodeScannerTarget);
                            if (input) {
                                input.value = value;
                                input.dispatchEvent(new Event("input", { bubbles: true }));
                                input.focus();
                            }
                            closeBarcodeScanner();
                            showToast(`بارکد ${value} شناسایی شد.`);
                            return;
                        }
                    }
                } catch (error) {
                    console.warn("Barcode detection:", error);
                }
            }
            barcodeScanTimer = setTimeout(scan, 180);
        };
        scan();
    } catch (error) {
        console.error("Camera error:", error);
        let message = "دسترسی به دوربین ممکن نشد.";
        if (error?.name === "NotAllowedError") message = "اجازه دوربین داده نشد. از تنظیمات مرورگر اجازه دوربین را فعال کنید.";
        else if (error?.name === "NotFoundError") message = "دوربین پیدا نشد.";
        status.textContent = message + " بارکد را دستی وارد کنید.";
    }
}

document.getElementById("scanBarcodeBtn")?.addEventListener("click", () => startBarcodeScanner("sale"));
document.getElementById("productScanBarcodeBtn")?.addEventListener("click", () => startBarcodeScanner("product"));
document.getElementById("closeBarcodeScannerBtn")?.addEventListener("click", closeBarcodeScanner);
document.getElementById("manualBarcodeBtn")?.addEventListener("click", () => {
    const input = getBarcodeInput(barcodeScannerTarget);
    closeBarcodeScanner();
    input?.focus();
    input?.select?.();
});
document.getElementById("barcodeScannerModal")?.addEventListener("click", event => {
    if (event.target.id === "barcodeScannerModal") closeBarcodeScanner();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeBarcodeScanner();
});


/* ============================================================
   REFRESH ALL
   ============================================================ */

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


/* ============================================================
   INITIALIZE
   ============================================================ */

async function initApp() {

    if (initialized) {

        return;
    }


    initialized = true;


    try {

        /*
         مرحله اول:
         اطلاعات محلی را سریع بارگذاری می‌کنیم.
         بنابراین صفحه هیچ‌وقت با دیتابیس صفر بالا نمی‌آید.
        */

        await loadLocalDatabase();


        setConnectionStatus(
            "اطلاعات فروشگاه آماده است",
            "local"
        );


        await refreshAll();


        /*
         مرحله دوم:
         تلاش برای اتصال خودکار به پوشه.

         اگر مرورگر مجوز را حفظ کرده باشد:
         بدون هیچ کلیک کاربر وصل می‌شود.

         اگر مجوز را حفظ نکرده باشد:
         هیچ درخواست دسترسی باز نمی‌کنیم.
         اطلاعات IndexedDB همچنان فعال می‌مانند.
        */

        await tryAutoConnect();


        console.log(
            "Bizadshop آماده است."
        );

    } catch (error) {

        console.error(
            "initApp:",
            error
        );


        /*
         حتی اگر IndexedDB هم مشکل داشته باشد،
         برنامه با دیتابیس خالی بالا می‌آید؛
         ولی دیگر حلقه اتصال ایجاد نمی‌شود.
        */

        try {

            database =
                createEmptyDatabase();

            await refreshAll();

        } catch (refreshError) {

            console.error(
                refreshError
            );
        }


        setConnectionStatus(
            "حالت محلی فعال است",
            "local"
        );


        showToast(
            "Bizadshop در حالت محلی اجرا شد."
        );
    }
}


/* ============================================================
   START
   ============================================================ */

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
