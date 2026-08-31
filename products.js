// ============================================================
// Bizadshop - Products
// مدیریت کالاها
// ============================================================


// ============================================================
// افزودن کالا
// ============================================================

async function addProduct({
    barcode,
    name,
    category = "",
    purchasePrice = 0,
    salePrice = 0,
    unit = "عدد",
    initialQuantity = 0
}) {

    barcode = String(barcode || "").trim();
    name = String(name || "").trim();
    category = String(category || "").trim();
    unit = String(unit || "عدد").trim();

    purchasePrice = Number(purchasePrice);
    salePrice = Number(salePrice);
    initialQuantity = Number(initialQuantity);


    // --------------------------------------------------------
    // بررسی اطلاعات
    // --------------------------------------------------------

    if (!barcode) {
        throw new Error("بارکد کالا وارد نشده است.");
    }

    if (!name) {
        throw new Error("نام کالا وارد نشده است.");
    }

    if (
        !Number.isFinite(purchasePrice) ||
        purchasePrice < 0
    ) {
        throw new Error("قیمت خرید نامعتبر است.");
    }

    if (
        !Number.isFinite(salePrice) ||
        salePrice < 0
    ) {
        throw new Error("قیمت فروش نامعتبر است.");
    }

    if (
        !Number.isFinite(initialQuantity) ||
        initialQuantity < 0
    ) {
        throw new Error("موجودی اولیه نامعتبر است.");
    }


    // --------------------------------------------------------
    // بررسی تکراری نبودن بارکد
    // --------------------------------------------------------

    const existingProduct =
        await dbGetByIndex(
            "products",
            "barcode",
            barcode
        );

    if (existingProduct) {
        throw new Error(
            "این بارکد قبلاً برای یک کالا ثبت شده است."
        );
    }


    // --------------------------------------------------------
    // ساخت شناسه کالا
    // --------------------------------------------------------

    const productId =
        generateId("product");

    const currentTime =
        nowISO();


    // --------------------------------------------------------
    // ساخت کالا
    // --------------------------------------------------------

    const product = {

        id: productId,

        barcode: barcode,

        name: name,

        category: category,

        purchasePrice: purchasePrice,

        salePrice: salePrice,

        unit: unit,

        createdAt: currentTime,

        updatedAt: currentTime
    };


    // --------------------------------------------------------
    // ذخیره کالا
    // --------------------------------------------------------

    await dbAdd(
        "products",
        product
    );


    // --------------------------------------------------------
    // ساخت موجودی اولیه
    // --------------------------------------------------------

    const inventory = {

        productId: productId,

        quantity: initialQuantity,

        updatedAt: currentTime
    };


    await dbAdd(
        "inventory",
        inventory
    );


    return product;
}


// ============================================================
// دریافت کالا با ID
// ============================================================

async function getProduct(productId) {

    if (!productId) {
        return null;
    }

    return await dbGet(
        "products",
        productId
    );
}


// ============================================================
// دریافت کالا با بارکد
// ============================================================

async function getProductByBarcode(barcode) {

    barcode = String(
        barcode || ""
    ).trim();

    if (!barcode) {
        return null;
    }

    return await dbGetByIndex(
        "products",
        "barcode",
        barcode
    );
}


// ============================================================
// دریافت همه کالاها
// ============================================================

async function getAllProducts() {

    return await dbGetAll(
        "products"
    );
}


// ============================================================
// تعداد کالاها
// ============================================================

async function getProductsCount() {

    return await dbCount(
        "products"
    );
}


// ============================================================
// ویرایش کالا
// ============================================================

async function updateProduct(
    productId,
    changes
) {

    if (!productId) {
        throw new Error(
            "شناسه کالا مشخص نیست."
        );
    }

    const product =
        await getProduct(productId);

    if (!product) {
        throw new Error(
            "کالا پیدا نشد."
        );
    }


    // --------------------------------------------------------
    // بارکد
    // --------------------------------------------------------

    if (
        changes.barcode !== undefined
    ) {

        const newBarcode =
            String(
                changes.barcode || ""
            ).trim();

        if (!newBarcode) {
            throw new Error(
                "بارکد نمی‌تواند خالی باشد."
            );
        }

        if (
            newBarcode !== product.barcode
        ) {

            const duplicate =
                await getProductByBarcode(
                    newBarcode
                );

            if (
                duplicate &&
                duplicate.id !== product.id
            ) {
                throw new Error(
                    "این بارکد قبلاً ثبت شده است."
                );
            }

            product.barcode =
                newBarcode;
        }
    }


    // --------------------------------------------------------
    // نام
    // --------------------------------------------------------

    if (
        changes.name !== undefined
    ) {

        const newName =
            String(
                changes.name || ""
            ).trim();

        if (!newName) {
            throw new Error(
                "نام کالا نمی‌تواند خالی باشد."
            );
        }

        product.name =
            newName;
    }


    // --------------------------------------------------------
    // دسته‌بندی
    // --------------------------------------------------------

    if (
        changes.category !== undefined
    ) {

        product.category =
            String(
                changes.category || ""
            ).trim();
    }


    // --------------------------------------------------------
    // قیمت خرید
    // --------------------------------------------------------

    if (
        changes.purchasePrice !== undefined
    ) {

        const price =
            Number(
                changes.purchasePrice
            );

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {
            throw new Error(
                "قیمت خرید نامعتبر است."
            );
        }

        product.purchasePrice =
            price;
    }


    // --------------------------------------------------------
    // قیمت فروش
    // --------------------------------------------------------

    if (
        changes.salePrice !== undefined
    ) {

        const price =
            Number(
                changes.salePrice
            );

        if (
            !Number.isFinite(price) ||
            price < 0
        ) {
            throw new Error(
                "قیمت فروش نامعتبر است."
            );
        }

        product.salePrice =
            price;
    }


    // --------------------------------------------------------
    // واحد
    // --------------------------------------------------------

    if (
        changes.unit !== undefined
    ) {

        product.unit =
            String(
                changes.unit || "عدد"
            ).trim();
    }


    product.updatedAt =
        nowISO();


    await dbPut(
        "products",
        product
    );


    return product;
}


// ============================================================
// حذف کالا
// ============================================================

async function deleteProduct(
    productId
) {

    if (!productId) {
        throw new Error(
            "شناسه کالا مشخص نیست."
        );
    }

    const product =
        await getProduct(productId);

    if (!product) {
        throw new Error(
            "کالا پیدا نشد."
        );
    }


    // --------------------------------------------------------
    // حذف کالا
    // --------------------------------------------------------

    await dbDelete(
        "products",
        productId
    );


    // --------------------------------------------------------
    // حذف موجودی کالا
    // --------------------------------------------------------

    await dbDelete(
        "inventory",
        productId
    );


    return true;
}


// ============================================================
// دریافت موجودی کالا
// ============================================================

async function getProductInventory(
    productId
) {

    if (!productId) {
        return null;
    }

    return await dbGet(
        "inventory",
        productId
    );
}


// ============================================================
// تغییر مستقیم موجودی
// ============================================================

async function setProductInventory(
    productId,
    quantity
) {

    quantity = Number(quantity);

    if (
        !Number.isFinite(quantity) ||
        quantity < 0
    ) {
        throw new Error(
            "موجودی نامعتبر است."
        );
    }


    const product =
        await getProduct(productId);

    if (!product) {
        throw new Error(
            "کالا پیدا نشد."
        );
    }


    const inventory = {

        productId: productId,

        quantity: quantity,

        updatedAt: nowISO()
    };


    await dbPut(
        "inventory",
        inventory
    );


    return inventory;
}


// ============================================================
// جستجوی کالا
// ============================================================

async function searchProducts(
    searchText
) {

    const text =
        String(
            searchText || ""
        )
        .trim()
        .toLowerCase();


    const products =
        await getAllProducts();


    if (!text) {
        return products;
    }


    return products.filter(
        product => {

            const barcode =
                String(
                    product.barcode || ""
                ).toLowerCase();

            const name =
                String(
                    product.name || ""
                ).toLowerCase();

            const category =
                String(
                    product.category || ""
                ).toLowerCase();


            return (
                barcode.includes(text) ||
                name.includes(text) ||
                category.includes(text)
            );
        }
    );
}


// ============================================================
// دریافت کالا به همراه موجودی
// ============================================================

async function getProductWithInventory(
    productId
) {

    const product =
        await getProduct(productId);

    if (!product) {
        return null;
    }


    const inventory =
        await getProductInventory(
            productId
        );


    return {

        ...product,

        quantity:
            inventory
                ? inventory.quantity
                : 0
    };
}


// ============================================================
// دریافت همه کالاها همراه موجودی
// ============================================================

async function getAllProductsWithInventory() {

    const products =
        await getAllProducts();


    const result = [];


    for (
        const product of products
    ) {

        const inventory =
            await getProductInventory(
                product.id
            );


        result.push({

            ...product,

            quantity:
                inventory
                    ? inventory.quantity
                    : 0
        });
    }


    return result;
}
