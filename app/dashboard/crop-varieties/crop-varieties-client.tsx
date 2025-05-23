'use client'; // Make this a client component to manage dialog state

import { useState } from 'react';
import type { Tables } from '@/lib/supabase';
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
import { CropVarietyForm } from '@/components/forms/CropVarietyForm';
import { deleteCropVariety } from '@/app/actions/crop-varieties';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Rename Type Alias table name
type CropVariety = Tables<'crop_varieties'>;

// Rename Props Interface
interface CropVarietiesClientProps {
  cropVarieties: CropVariety[]; // Rename prop
}

// Rename Component and Props
export function CropVarietiesClient({ cropVarieties }: CropVarietiesClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Rename state variable
  const [editingCropVariety, setEditingCropVariety] = useState<CropVariety | null>(null);

  // Update parameter type and state setter
  const handleEdit = (cropVariety: CropVariety) => {
    setEditingCropVariety(cropVariety);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    // Update state setter
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
          // Note: Revalidation happens in the server action, the page should update automatically.
        }
      } catch (error) {
        console.error("Delete Error:", error);
        toast.error('An unexpected error occurred while deleting the crop variety.');
      }
    }
  };

  const closeDialog = () => {
      setIsDialogOpen(false);
      // Update state setter
      setEditingCropVariety(null);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        {/* Update Title */}
        <h1 className="text-2xl font-semibold">Manage Crop Varieties</h1>
        {/* Update Button Text */}
        <Button onClick={handleAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Crop Variety
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* DialogTrigger is handled by the Add/Edit buttons */}
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            {/* Update state variable reference */}
            <DialogTitle>{editingCropVariety ? 'Edit Crop Variety' : 'Add New Crop Variety'}</DialogTitle>
            <DialogDescription>
              {/* Update state variable reference */}
              {editingCropVariety ? 'Make changes to the crop variety details.' : 'Enter the details for the new crop variety.'}
            </DialogDescription>
          </DialogHeader>
          {/* Pass closeDialog and updated state variable to the form */}
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
            {/* Update prop reference and empty state text */}
            {cropVarieties.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center">No crop varieties found.</TableCell>
                </TableRow>
            )}
            {/* Update prop reference and map variable */}
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
                      variant={
                        'outline'
                      }
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
                   {/* Update edit handler parameter */}
                   <Button variant="ghost" size="icon" onClick={() => handleEdit(cropVariety)} className="mr-2">
                       <Pencil className="h-4 w-4" />
                   </Button>
                    {/* Update delete handler parameter */}
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