"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type TableRecord = {
  id: string
  number: string
  qrToken: string
  locationVi: string
  locationEn: string
  isOccupied: boolean
  scanCount: number
}

type TablesContextValue = {
  tables: TableRecord[]
  addTable: () => void
  renameTable: (id: string, number: string) => void
  updateLocation: (id: string, locationVi: string, locationEn: string) => void
  toggleOccupied: (id: string) => void
  regenerateToken: (id: string) => void
  activeTable: TableRecord | null
  setActiveTableByToken: (token: string) => TableRecord | null
  clearActiveTable: () => void
}

const TablesContext = createContext<TablesContextValue | null>(null)

const TABLES_STORAGE_KEY = "phadincoffee-tables"
const ACTIVE_TABLE_STORAGE_KEY = "phadincoffee-active-table"

/**
 * Fixed, easy-to-type demo tokens so this can actually be tested by
 * visiting /table/table-1, /table/table-2, etc. — real tokens (once the
 * `tables` table exists) would be opaque random strings, not this readable.
 */
const DEFAULT_TABLES: TableRecord[] = [
  { id: "t1", number: "1", qrToken: "table-1", locationVi: "Khu vực cửa sổ", locationEn: "Window Area", isOccupied: false, scanCount: 0 },
  { id: "t2", number: "2", qrToken: "table-2", locationVi: "Khu trung tâm", locationEn: "Center Hall", isOccupied: true, scanCount: 0 },
  { id: "t3", number: "3", qrToken: "table-3", locationVi: "Tầng 1 - Ban công", locationEn: "Floor 1 - Balcony", isOccupied: false, scanCount: 0 },
  { id: "t4", number: "4", qrToken: "table-4", locationVi: "Tầng 1 - Trong nhà", locationEn: "Floor 1 - Indoor", isOccupied: false, scanCount: 0 },
  { id: "t5", number: "5", qrToken: "table-5", locationVi: "Khu vực Bar", locationEn: "Bar Area", isOccupied: false, scanCount: 0 },
  { id: "t6", number: "6", qrToken: "table-6", locationVi: "Sân vườn", locationEn: "Garden", isOccupied: false, scanCount: 0 },
]

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function TablesProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<TableRecord[]>(DEFAULT_TABLES)
  const [activeTable, setActiveTable] = useState<TableRecord | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const storedTables = window.localStorage.getItem(TABLES_STORAGE_KEY)
      if (storedTables) setTables(JSON.parse(storedTables))
      const storedActive = window.localStorage.getItem(ACTIVE_TABLE_STORAGE_KEY)
      if (storedActive) setActiveTable(JSON.parse(storedActive))
    } catch {
      // ignore malformed/unavailable storage
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables))
  }, [tables, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (activeTable) {
      window.localStorage.setItem(ACTIVE_TABLE_STORAGE_KEY, JSON.stringify(activeTable))
    } else {
      window.localStorage.removeItem(ACTIVE_TABLE_STORAGE_KEY)
    }
  }, [activeTable, hydrated])

  function addTable() {
    const highestNumber = tables.reduce((max, table) => {
      const parsed = Number(table.number)
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max
    }, 0)
    const nextNumber = String(highestNumber + 1)

    setTables((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        number: nextNumber,
        qrToken: randomToken(),
        locationVi: "",
        locationEn: "",
        isOccupied: false,
        scanCount: 0,
      },
    ])
  }

  function renameTable(id: string, number: string) {
    setTables((prev) => prev.map((table) => (table.id === id ? { ...table, number } : table)))
    setActiveTable((prev) => (prev?.id === id ? { ...prev, number } : prev))
  }

  function updateLocation(id: string, locationVi: string, locationEn: string) {
    setTables((prev) =>
      prev.map((table) => (table.id === id ? { ...table, locationVi, locationEn } : table))
    )
    setActiveTable((prev) => (prev?.id === id ? { ...prev, locationVi, locationEn } : prev))
  }

  function toggleOccupied(id: string) {
    setTables((prev) =>
      prev.map((table) => (table.id === id ? { ...table, isOccupied: !table.isOccupied } : table))
    )
  }

  function regenerateToken(id: string) {
    setTables((prev) =>
      prev.map((table) => (table.id === id ? { ...table, qrToken: randomToken() } : table))
    )
  }

  function setActiveTableByToken(token: string): TableRecord | null {
    const found = tables.find((table) => table.qrToken === token) ?? null
    if (found) {
      setTables((prev) =>
        prev.map((table) => (table.id === found.id ? { ...table, scanCount: table.scanCount + 1 } : table))
      )
    }
    setActiveTable(found)
    return found
  }

  function clearActiveTable() {
    setActiveTable(null)
  }

  return (
    <TablesContext.Provider
      value={{
        tables,
        addTable,
        renameTable,
        updateLocation,
        toggleOccupied,
        regenerateToken,
        activeTable,
        setActiveTableByToken,
        clearActiveTable,
      }}
    >
      {children}
    </TablesContext.Provider>
  )
}

export function useTables(): TablesContextValue {
  const ctx = useContext(TablesContext)
  if (!ctx) throw new Error("useTables must be used within a TablesProvider")
  return ctx
}
