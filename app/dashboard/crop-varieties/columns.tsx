'use client'

import { ColumnDef } from "@tanstack/react-table"
import type { Tables } from '@/lib/supabase';
import { Checkbox } from "@/components/ui/checkbox"; // If needed for selection column
import { Badge } from "@/components/ui/badge";
// Actions (Edit/Delete) can be handled in the client component or via a dedicated column component

// Define the shape of our data (using the alias for the plant type)
// Update Type Alias
type CropVariety = Tables<'crop_varieties'>

export const columns: ColumnDef<CropVariety>[] = [
  // Example Basic Columns (customize as needed)
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "variety",
    header: "Variety",
    // Cell rendering can be added back later with proper typing if needed
  },
  {
    accessorKey: "latin_name",
    header: "Latin Name",
  },
  {
    accessorKey: "is_organic",
    header: "Organic",
  },
  {
    accessorKey: "avg_days_to_maturity",
    header: "Days to Maturity",
  },
  // Add new columns
  {
    accessorKey: "color",
    header: "Color",
  },
  {
    accessorKey: "size",
    header: "Size",
  },
  {
    accessorKey: "disease_resistance",
    header: "Disease Resistance",
  },
   {
    accessorKey: "hybrid_status",
    header: "Hybrid Status",
  },
  {
    accessorKey: "notes",
    header: "Notes",
    // Potentially hide this by default or format for brevity
  },
  // Add more columns as needed (e.g., created_at, updated_at)

  // Example Actions Column (often handled directly in the table row rendering in the client component)
  // {
  //   id: "actions",
  //   cell: ({ row }) => {
  //     const plant = row.original
  //     // Action buttons (Edit, Delete) would go here
  //     // This often requires passing handlers down or using context
  //     return (<div>...</div>)
  //   },
  // },
] 