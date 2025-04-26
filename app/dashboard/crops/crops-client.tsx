'use client'; // Client component for dialog state and actions

import { useState } from 'react';
import type { Tables, Database } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // For status display
import { CropForm } from '@/components/forms/CropForm';
import { deleteCrop, type CropStatus } from '@/app/actions/crops';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns'; // For formatting dates

// Define types based on the updated actions file
type Crop = Tables<'crops'>; // Base type now includes crop_variety_id
type CropVariety = Database['public']['Tables']['crop_varieties']['Row']; 
type Bed = Tables<'beds'> & { plots?: { name: string } | null };

// Align with CropWithDetails from app/actions/crops.ts
type CropWithDetails = Crop & {
  crop_varieties: { name: string; variety: string | null } | null; 
  beds: { name: string, plots: { name: string } | null } | null;
};

interface CropsClientProps {
  crops: CropWithDetails[];
  cropVarieties: CropVariety[]; // For the form
  beds: Bed[]; // For the form
}

// Client Component for Crops Page
export function CropsClient({ crops, cropVarieties, beds }: CropsClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);

  const handleEdit = (crop: Crop) => {
    setEditingCrop(crop);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCrop(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this crop record?')) {
        return;
    }
    const result = await deleteCrop(id);
     if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message);
    } else {
        toast.success(result.message);
    }
  };

   const closeDialog = () => {
      setIsDialogOpen(false);
      setEditingCrop(null);
  }

  // Helper to format display dates
  const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return 'N/A';
      try {
          return format(new Date(dateString), 'MMM d, yyyy');
      } catch {
          return 'Invalid Date';
      }
  };

  // Helper to get badge variant based on status
  // Use imported CropStatus type
  const getStatusVariant = (status: CropStatus | null): "default" | "secondary" | "destructive" | "outline" | null | undefined => {
    switch (status) {
        case 'planted': return 'default';
        case 'growing': return 'secondary';
        case 'harvested': return 'outline';
        case 'planned':
        default: return 'secondary';
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Manage Crops</h1>
        <Button onClick={handleAdd} size="sm">
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Crop
        </Button>
      </div>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCrop ? 'Edit Crop' : 'Add New Crop'}</DialogTitle>
            <DialogDescription>
              {editingCrop ? 'Update the details of the crop.' : 'Enter the details for the new crop.'}
            </DialogDescription>
          </DialogHeader>
          <CropForm crop={editingCrop} cropVarieties={cropVarieties} beds={beds} closeDialog={closeDialog} />
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variety Name</TableHead>
              <TableHead>Variety Specifier</TableHead>
              <TableHead>Bed (Plot)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Planted</TableHead>
              <TableHead>Harvested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {crops.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="text-center">No crops found.</TableCell>
                </TableRow>
            )}
            {crops.map((crop) => (
              <TableRow key={crop.id}>
                <TableCell className="font-medium">{crop.crop_varieties?.name ?? 'N/A'}</TableCell>
                <TableCell>{crop.crop_varieties?.variety ?? 'N/A'}</TableCell>
                <TableCell>{crop.beds?.name ?? 'N/A'} ({crop.beds?.plots?.name ?? 'N/A'})</TableCell>
                <TableCell>
                    <Badge variant={getStatusVariant(crop.status as CropStatus | null)}>{crop.status ?? 'N/A'}</Badge>
                </TableCell>
                <TableCell>{formatDate(crop.planted_date)}</TableCell>
                <TableCell>{formatDate(crop.harvested_date)}</TableCell>
                <TableCell className="text-right">
                   <Button variant="ghost" size="icon" onClick={() => handleEdit(crop)} className="mr-2">
                       <Pencil className="h-4 w-4" />
                   </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(crop.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 