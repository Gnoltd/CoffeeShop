import { getTranslations } from "next-intl/server"
import { AddressBookView } from "@/components/customer/address-book-view"

export default async function AddressesPage() {
  const t = await getTranslations("Addresses")
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <AddressBookView />
    </>
  )
}
