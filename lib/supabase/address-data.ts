import type { SupabaseClient } from "@supabase/supabase-js"

export type Address = {
  id: string
  label: string
  address: string
  phone: string
  isDefault: boolean
}

export type AddressInput = {
  label: string
  address: string
  phone: string
}

type AddressRow = {
  id: string
  label: string
  address: string
  phone: string
  is_default: boolean
}

function mapAddressRow(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    phone: row.phone,
    isDefault: row.is_default,
  }
}

export async function getAddresses(supabase: SupabaseClient, userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("id, label, address, phone, is_default")
    .eq("customer_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
  if (error) throw error
  return ((data ?? []) as AddressRow[]).map(mapAddressRow)
}

export async function addAddress(supabase: SupabaseClient, userId: string, input: AddressInput): Promise<Address> {
  const { data, error } = await supabase
    .from("customer_addresses")
    .insert({ customer_id: userId, label: input.label, address: input.address, phone: input.phone })
    .select("id, label, address, phone, is_default")
    .single()
  if (error) throw error
  return mapAddressRow(data as AddressRow)
}

export async function updateAddress(supabase: SupabaseClient, addressId: string, input: AddressInput): Promise<void> {
  const { error } = await supabase
    .from("customer_addresses")
    .update({ label: input.label, address: input.address, phone: input.phone })
    .eq("id", addressId)
  if (error) throw error
}

export async function deleteAddress(supabase: SupabaseClient, addressId: string): Promise<void> {
  const { error } = await supabase.from("customer_addresses").delete().eq("id", addressId)
  if (error) throw error
}

export async function setDefaultAddress(supabase: SupabaseClient, addressId: string): Promise<void> {
  const { error } = await supabase.rpc("set_default_address", { p_address_id: addressId })
  if (error) throw error
}
