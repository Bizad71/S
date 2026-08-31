// ============================================================
// Bizadshop
// Complete Local App
// IndexedDB + Products + Inventory + Sales
// ============================================================


const DB_NAME = "BizadshopDB";
const DB_VERSION = 1;

let db = null;

let cart = [];


// ============================================================
// DATABASE
// ============================================================

function openDB() {

    return new Promise((resolve, reject) => {

        if (db) {
            resolve(db);
            return;
        }

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded = function (event) {

            const database =
                event.target.result;


            if (
                !database.objectStoreNames.contains(
                    "shop"
                )
            ) {

                database.createObjectStore(
                    "shop",
                    {
                        keyPath: "id"
                    }
                );
            }


            if (
                !database.objectStoreNames.contains(
                    "products"
                )
            ) {

                const store =
                    database.createObjectStore(
                        "products",
                        {
                            keyPath: "id"
                        }
                    );

                store.createIndex(
                    "barcode",
                    "barcode",
                    {
                        unique: true
                    }
                );

                store.createIndex(
                    "name",
                    "name",
                    {
                        unique: false
                    }
                );

                store.createIndex(
                    "category",
                    "category",
                    {
                        unique: false
                    }
                );
            }


            if (
                !database.objectStoreNames.contains(
                    "inventory"
                )
            ) {

                database.createObjectStore(
                    "inventory",
                    {
                        keyPath: "productId"
                    }
                );
            }


            if (
                !database.objectStoreNames.contains(
                    "sales"
                )
            ) {

                const store =
                    database.createObjectStore(
                        "sales",
                        {
                            keyPath: "id"
                        }
                    );

                store.createIndex(
                    "createdAt",
                    "createdAt",
                    {
                        unique: false
                    }
                );
            }


            if (
                !database.objectStoreNames.contains(
                    "sale_items"
                )
            ) {

                const store =
                    database.createObjectStore(
                        "sale_items",
                        {
                            keyPath: "id"
                        }
                    );

                store.createIndex(
                    "saleId",
                    "saleId",
                    {
                        unique: false
                    }
                );

                store.createIndex(
                    "productId",
                    "productId",
                    {
                        unique: false
                    }
                );
            }


            if (
                !database.objectStoreNames.contains(
                    "settings"
                )
            ) {

                database.createObjectStore(
                    "settings",
                    {
                        keyPath: "key"
                    }
                );
            }

        };


        request.onsuccess = function (event) {

            db = event.target.result;

            resolve(db);
        };


        request.onerror = function () {

            reject(
                request.error
            );
        };

    });
}


// ============================================================
// DATABASE HELPERS
// ============================================================

async function dbAdd(
    storeName,
    data
) {

    const database =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    storeName
                );

            const request =
                store.add(data);


            request.onsuccess =
                () => resolve(
                    request.result
                );

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}


async function dbPut(
    storeName,
    data
) {

    const database =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    storeName
                );

            const request =
                store.put(data);


            request.onsuccess =
                () => resolve(
                    request.result
                );

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}


async function dbGet(
    storeName,
    key
) {

    const database =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    storeName
                );

            const request =
                store.get(key);


            request.onsuccess =
                () => resolve(
                    request.result
                );

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}


async function dbGetAll(
    storeName
) {

    const database =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    storeName
                );

            const request =
                store.getAll();


            request.onsuccess =
                () => resolve(
                    request.result
                );

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}


async function dbDelete(
    storeName,
    key
) {

    const database =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    storeName
                );

            const request =
                store.delete(key);


            request.onsuccess =
                () => resolve(true);

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}


async function dbGetByIndex(
    storeName,
    indexName,
    value
) {

    const database =
        await openDB();

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    storeName,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    storeName
                );

            const index =
                store.index(indexName);

            const request =
                index.get(value);


            request.onsuccess =
                () => resolve(
                    request.result
                );

            request.onerror =
                () => reject(
                    request.error
                );
        }
    );
}


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


// ============================================================
// PRODUCTS
// ============================================================

async function getProducts() {

    return await dbGetAll(
        "products"
    );
}


async function getProduct(id) {

    return await dbGet(
        "products",
        id
    );
}


async function getProductByBarcode(
    barcode
) {

    return await dbGetByIndex(
        "products",
        "barcode",
        String(barcode).trim()
    );
}


async function getInventory(
    productId
) {

    return await dbGet(
        "inventory",
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
        ? Number(inventory.quantity) || 0
        : 0;
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
        existing.id !== product.id
    ) {

        throw new Error(
            "این بارکد قبلاً ثبت شده است."
        );
    }


    await dbPut(
        "products",
        product
    );


    const currentInventory =
        await getInventory(
            product.id
        );


    if (!currentInventory) {

        await dbPut(
            "inventory",
            {
                productId:
                    product.id,

                quantity:
                    Number(
                        product.initialQuantity
                    ) || 0,

                updatedAt:
                    nowISO()
            }
        );

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
                        : "کالا با موفقیت اضافه شد."
                );


            } catch (error) {

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


    await dbDelete(
        "products",
        productId
    );


    await dbDelete(
        "inventory",
        productId
    );


    cart =
        cart.filter(
            item =>
                item.productId !==
                productId
        );


    await refreshAll();

    renderCart();

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
                product => {

                    return (
                        product.name
                            .toLowerCase()
                            .includes(text)
                        ||
                        product.barcode
                            .toLowerCase()
                            .includes(text)
                        ||
                        (
                            product.category ||
                            ""
                        )
                        .toLowerCase()
                        .includes(text)
                    );

                }
            );
    }


    products.sort(
        (a, b) =>
            b.createdAt
                .localeCompare(
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


        let stockClass =
            "good";


        if (quantity <= 0) {
            stockClass = "empty";
        }
        else if (quantity <= 5) {
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

                    return (
                        product.name
                            .toLowerCase()
                            .includes(text)
                        ||
                        product.barcode
                            .toLowerCase()
                            .includes(text)
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
            stockClass = "empty";
        }
        else if (quantity <= 5) {
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


    if (!product) {
        return;
    }


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
                await getQuantity(
                    productId
                )
            }`;


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
    .getElementById(
        "stockForm"
    )
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
                    action ===
                    "increase"
                ) {

                    newQuantity =
                        current +
                        amount;

                }
                else if (
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

                }
                else {

                    newQuantity =
                        amount;
                }


                await dbPut(
                    "inventory",
                    {

                        productId:
                            productId,

                        quantity:
                            newQuantity,

                        updatedAt:
                            nowISO()
                    }
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
                    error.message
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


    const product =
        await getProduct(
            productId
        );


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


    // --------------------------------------------------------
    // Check stock first
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Save sale
    // --------------------------------------------------------

    await dbAdd(
        "sales",
        {

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
        }
    );


    // --------------------------------------------------------
    // Save sale items + decrease stock
    // --------------------------------------------------------

    for (
        const item of saleItems
    ) {

        await dbAdd(
            "sale_items",
            item
        );


        const current =
            await getQuantity(
                item.productId
            );


        await dbPut(
            "inventory",
            {

                productId:
                    item.productId,

                quantity:
                    current -
                    item.quantity,

                updatedAt:
                    nowISO()
            }
        );
    }


    cart = [];


    await refreshAll();

    renderCart();


    showToast(
        "فروش با موفقیت ثبت شد."
    );
}


// ============================================================
// TODAY SALES
// ============================================================

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

    const sales =
        await dbGetAll(
            "sales"
        );


    return sales.filter(
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

                return (
                    product.name
                        .toLowerCase()
                        .includes(text)
                    ||
                    product.barcode
                        .toLowerCase()
                        .includes(text)
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
                        ${escapeHTML(
                            product.barcode
                        )}
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

    document
        .getElementById(
            id
        )
        .classList.add(
            "show"
        );
}


function closeModal(
    id
) {

    document
        .getElementById(
            id
        )
        .classList.remove(
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
// SCANNER PLACEHOLDER
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
// INITIALIZE
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


async function initApp() {

    try {

        await openDB();

        await refreshAll();

        console.log(
            "Bizadshop آماده است."
        );

    } catch (error) {

        console.error(
            error
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
