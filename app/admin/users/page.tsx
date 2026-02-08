"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Search, Users, ChevronLeft, ChevronRight } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const typeColors: Record<string, string> = {
  coworker: "bg-blue-100 text-blue-800",
  partner: "bg-amber-100 text-amber-800",
  admin: "bg-destructive/10 text-destructive",
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set("search", search)
  if (typeFilter !== "all") params.set("type", typeFilter)

  const { data, isLoading } = useSWR(`/api/admin/users?${params}`, fetcher)

  const users = data?.users || []
  const totalPages = data?.totalPages || 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage all platform users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {["all", "coworker", "partner", "admin"].map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1) }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user: Record<string, unknown>) => (
            <Card key={user.id as string} className="border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(user.display_name as string)?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{user.display_name as string}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{user.work_type as string || "No work type"}</span>
                      <span>{"·"}</span>
                      <span>Joined {new Date(user.created_at as string).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>
                <Badge className={typeColors[user.user_type as string] || ""} variant="secondary">
                  {user.user_type as string}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
