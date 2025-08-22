'use client';

import { useState } from 'react';
import type { Tables } from '@/lib/supabase-server';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
import Image from 'next/image';
import { toast } from "sonner";

type CropVariety = Tables<'crop_varieties'> & { crops?: { name: string } | null } & { image_url?: string | null };
type Crop = { id: number; name: string };

interface CropVarietiesPageContentProps {
  cropVarieties: CropVariety[];
  crops?: Crop[];
}

export function CropVarietiesPageContent({ cropVarieties, crops = [] }: CropVarietiesPageContentProps) {
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

  const handleDelete = async (id: number | string) => {
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

  const formId = "crop-variety-form";

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
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingCropVariety ? 'Edit Crop Variety' : 'Add New Crop Variety'}</DialogTitle>
            <DialogDescription>
              {editingCropVariety ? 'Make changes to the crop variety details.' : 'Enter the details for the new crop variety.'}
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-6 px-6 overflow-y-auto flex-1">
            <CropVarietyForm formId={formId} cropVariety={editingCropVariety} crops={crops} closeDialog={closeDialog} />
          </div>
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button type="submit" form={formId}>
              {editingCropVariety ? 'Update Crop Variety' : 'Create Crop Variety'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Crop</TableHead>
              <TableHead>Variety</TableHead>
              <TableHead>Latin Name</TableHead>
              <TableHead>Organic</TableHead>
              <TableHead>DTM (DS)</TableHead>
              <TableHead>DTM (TP)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cropVarieties.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center">No crop varieties found.</TableCell>
              </TableRow>
            )}
            {cropVarieties.map((cropVariety) => (
              <TableRow key={cropVariety.id}>
                <TableCell>
                  {cropVariety.image_url ? (
                    <Image
                      src={cropVariety.image_url}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded border bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{cropVariety.crops?.name ?? 'N/A'}</TableCell>
                <TableCell>{cropVariety.name}</TableCell>
                <TableCell className="font-serif italic text-muted-foreground text-sm whitespace-nowrap">
                  {cropVariety.latin_name ?? 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge variant={cropVariety.is_organic ? 'secondary' : 'outline'}>
                    {cropVariety.is_organic ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>{cropVariety.dtm_direct_seed_min}-{cropVariety.dtm_direct_seed_max}</TableCell>
                <TableCell>{cropVariety.dtm_transplant_min}-{cropVariety.dtm_transplant_max}</TableCell>
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
