'use client';

import { useState } from 'react';
import type { Tables } from '@/lib/supabase-server';
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
import { CropVarietyForm } from '../_components/CropVarietyForm';
import { deleteCropVariety } from '../_actions';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type CropVariety = Tables<'crop_varieties'>;

interface CropVarietiesPageContentProps {
  cropVarieties: CropVariety[];
}

export function CropVarietiesPageContent({ cropVarieties }: CropVarietiesPageContentProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCropVariety, setEditingCropVariety] = useState<CropVariety | null>(null);

  const handleEdit = (cropVariety: CropVariety) => {
    setEditingCropVariety(cropVariety);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCropVariety(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this crop variety? This might fail if it is linked to existing crops.')) {
      try {
        const result = await deleteCropVariety(id);
        if (result.message.startsWith('Database Error:')) {
          toast.error(result.message);
        } else {
          toast.success(result.message);
        }
      } catch (error) {
        console.error("Delete Error:", error);
        toast.error('An unexpected error occurred while deleting the crop variety.');
      }
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCropVariety(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Manage Crop Varieties</h1>
        <Button onClick={handleAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Crop Variety
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCropVariety ? 'Edit Crop Variety' : 'Add New Crop Variety'}</DialogTitle>
            <DialogDescription>
              {editingCropVariety ? 'Make changes to the crop variety details.' : 'Enter the details for the new crop variety.'}
            </DialogDescription>
          </DialogHeader>
          <CropVarietyForm cropVariety={editingCropVariety} closeDialog={closeDialog} />
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Variety</TableHead>
              <TableHead>Latin Name</TableHead>
              <TableHead>Organic</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Hybrid Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cropVarieties.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No crop varieties found.</TableCell>
              </TableRow>
            )}
            {cropVarieties.map((cropVariety) => (
              <TableRow key={cropVariety.id}>
                <TableCell className="font-medium">{cropVariety.name}</TableCell>
                <TableCell>{cropVariety.variety ?? 'N/A'}</TableCell>
                <TableCell>{cropVariety.latin_name ?? 'N/A'}</TableCell>
                <TableCell>{cropVariety.is_organic ? 'Yes' : 'No'}</TableCell>
                <TableCell>{cropVariety.color ?? 'N/A'}</TableCell>
                <TableCell>
                  {cropVariety.size ? (
                    <Badge 
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      {cropVariety.size}
                    </Badge>
                  ) : (
                    'N/A'
                  )}
                </TableCell>
                <TableCell>
                  {cropVariety.hybrid_status ? (
                    <Badge
                      variant={'outline'}
                      className={
                        cropVariety.hybrid_status === 'Hybrid'
                          ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                          : cropVariety.hybrid_status === 'Open Pollinated'
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                            : 'border-amber-500 text-amber-600 hover:bg-amber-100'
                      }
                    >
                      {cropVariety.hybrid_status}
                    </Badge>
                  ) : (
                    'N/A'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(cropVariety)} className="mr-2">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cropVariety.id)} className="text-red-500 hover:text-red-700">
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


