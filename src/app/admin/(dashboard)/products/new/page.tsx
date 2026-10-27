import { requireStaffPage } from "@/lib/auth";
import { categoryOptions } from "@/lib/admin/categories";
import { createProduct } from "@/app/admin/actions/products";
import { ActionForm } from "@/components/admin/ActionForm";
import { ProductFields } from "@/components/admin/ProductForm";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaffPage("catalog:write");
  const categories = await categoryOptions();
  return (
    <div className="max-w-4xl">
      <PageHeader back={{ href: "/admin/products", label: "Products" }} title="New product" description="Create the product, then add images, sizes, colours and stock." />
      <Card>
        <ActionForm action={createProduct} submitLabel="Create product">
          <ProductFields categories={categories} />
        </ActionForm>
      </Card>
    </div>
  );
}
