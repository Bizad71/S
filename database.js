// ============================================================
// Bizadshop - Local Database
// IndexedDB Database Layer
// ============================================================

const BIZADSHOP_DB_NAME = "BizadshopDB";
const BIZADSHOP_DB_VERSION = 1;

let bizadshopDB = null;


// ============================================================
// Open Database
// ============================================================

function openBizadshopDB() {
    return new Promise((resolve, reject) => {

        if (bizadshopDB) {
            resolve(bizadshopDB);
            return;
        }

        const request = indexedDB.open(
            BIZADSHOP_DB_NAME,
            BIZADSHOP_DB_VERSION
        );

        request.onupgradeneeded = function (event) {

            const db = event.target.result;


            // ==================================================
            // SHOP
            // ==================================================

            if (!db.objectStoreNames.contains("shop")) {

                const shopStore = db.createObjectStore(
                    "shop",
                    {
                        keyPath: "id"
                    }
                );

                shopStore.createIndex(
                    "name",
                    "name",
                    { unique: false }
                );
            }


            // ==================================================
            // PRODUCTS
            // ==================================================

            if (!db.objectStoreNames.contains("products")) {

                const productStore = db.createObjectStore(
                    "products",
                    {
                        keyPath: "id"
                    }
                );

                productStore.createIndex(
                    "barcode",
                    "barcode",
                    { unique: true }
                );

                productStore.createIndex(
                    "name",
                    "name",
                    { unique: false }
                );

                productStore.createIndex(
                    "category",
                    "category",
                    { unique: false }
                );

                productStore.createIndex(
                    "updatedAt",
                    "updatedAt",
                    { unique: false }
                );
            }


            // ==================================================
            // INVENTORY
            // ==================================================

            if (!db.objectStoreNames.contains("inventory")) {

                const inventoryStore = db.createObjectStore(
                    "inventory",
                    {
                        keyPath: "productId"
                    }
                );

                inventoryStore.createIndex(
                    "quantity",
                    "quantity",
                    { unique: false }
                );

                inventoryStore.createIndex(
                    "updatedAt",
                    "updatedAt",
                    { unique: false }
                );
            }


            // ==================================================
            // SALES
            // ==================================================

            if (!db.objectStoreNames.contains("sales")) {

                const salesStore = db.createObjectStore(
                    "sales",
                    {
                        keyPath: "id"
                    }
                );

                salesStore.createIndex(
                    "createdAt",
                    "createdAt",
                    { unique: false }
                );

                salesStore.createIndex(
                    "finalAmount",
                    "finalAmount",
                    { unique: false }
                );
            }


            // ==================================================
            // SALE ITEMS
            // ==================================================

            if (!db.objectStoreNames.contains("sale_items")) {

                const saleItemsStore = db.createObjectStore(
                    "sale_items",
                    {
                        keyPath: "id"
                    }
                );

                saleItemsStore.createIndex(
                    "saleId",
                    "saleId",
                    { unique: false }
                );

                saleItemsStore.createIndex(
                    "productId",
                    "productId",
                    { unique: false }
                );
            }


            // ==================================================
            // SETTINGS
            // ==================================================

            if (!db.objectStoreNames.contains("settings")) {

                db.createObjectStore(
                    "settings",
                    {
                        keyPath: "key"
                    }
                );
            }


            // ==================================================
            // METADATA
            // ==================================================

            if (!db.objectStoreNames.contains("metadata")) {

                db.createObjectStore(
                    "metadata",
                    {
                        keyPath: "key"
                    }
                );
            }
        };


        // ======================================================
        // SUCCESS
        // ======================================================

        request.onsuccess = function (event) {

            bizadshopDB = event.target.result;

            bizadshopDB.onversionchange = function () {
                bizadshopDB.close();
                bizadshopDB = null;
            };

            resolve(bizadshopDB);
        };


        // ======================================================
        // ERROR
        // ======================================================

        request.onerror = function () {

            reject(
                new Error(
                    "خطا در باز کردن دیتابیس Bizadshop"
                )
            );
        };
    });
}


// ============================================================
// ADD
// ============================================================

function dbAdd(storeName, data) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readwrite"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.add(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// PUT
// ============================================================

function dbPut(storeName, data) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readwrite"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.put(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// GET
// ============================================================

function dbGet(storeName, key) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readonly"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// DELETE
// ============================================================

function dbDelete(storeName, key) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readwrite"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.delete(key);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// GET ALL
// ============================================================

function dbGetAll(storeName) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readonly"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// GET BY INDEX
// ============================================================

function dbGetByIndex(
    storeName,
    indexName,
    value
) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readonly"
            );

            const store =
                transaction.objectStore(storeName);

            const index =
                store.index(indexName);

            const request =
                index.get(value);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// GET ALL BY INDEX
// ============================================================

function dbGetAllByIndex(
    storeName,
    indexName,
    value
) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readonly"
            );

            const store =
                transaction.objectStore(storeName);

            const index =
                store.index(indexName);

            const request =
                index.getAll(value);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// COUNT
// ============================================================

function dbCount(storeName) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readonly"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// CLEAR
// ============================================================

function dbClear(storeName) {

    return openBizadshopDB().then(db => {

        return new Promise((resolve, reject) => {

            const transaction = db.transaction(
                storeName,
                "readwrite"
            );

            const store =
                transaction.objectStore(storeName);

            const request = store.clear();

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    });
}


// ============================================================
// GENERATE ID
// ============================================================

function generateId(prefix = "id") {

    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
}


// ============================================================
// CURRENT TIME
// ============================================================

function nowISO() {
    return new Date().toISOString();
}


// ============================================================
// INITIALIZE DATABASE
// ============================================================

async function initBizadshopDB() {

    try {

        const db = await openBizadshopDB();

        console.log(
            "Bizadshop Database آماده است:",
            db.name
        );

        return db;

    } catch (error) {

        console.error(
            "Bizadshop Database Error:",
            error
        );

        throw error;
    }
}


// ============================================================
// AUTO INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {
        initBizadshopDB();
    }
);
