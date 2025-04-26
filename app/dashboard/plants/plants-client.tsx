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
import { PlantForm } from '@/components/forms/PlantForm';
import { deletePlant } from '@/app/actions/plants';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import { toast } from "sonner";

type Plant = Tables<'plants'>;

interface PlantsClientProps {
  plants: Plant[]; // Accept plants data fetched server-side
}

// Client Component to handle interactions (Dialog, Delete)
export function PlantsClient({ plants }: PlantsClientProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);

  const handleEdit = (plant: Plant) => {
    setEditingPlant(plant);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingPlant(null); // Clear any editing state
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plant?')) {
        return;
    }
    const result = await deletePlant(id);
    if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
        toast.error(result.message);
    } else {
        toast.success(result.message);
        // Note: Revalidation happens in the server action, the page should update automatically.
    }
  };

  const closeDialog = () => {
      setIsDialogOpen(false);
      setEditingPlant(null);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Manage Plants</h1>
        <Button onClick={handleAdd} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Plant
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* DialogTrigger is handled by the Add/Edit buttons */}
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingPlant ? 'Edit Plant' : 'Add New Plant'}</DialogTitle>
            <DialogDescription>
              {editingPlant ? 'Update the details of the plant.' : 'Enter the details for the new plant.'}
            </DialogDescription>
          </DialogHeader>
          {/* Pass closeDialog to the form */}
          <PlantForm plant={editingPlant} closeDialog={closeDialog} />
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
              <TableHead>Days to Maturity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plants.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="text-center">No plants found.</TableCell>
                </TableRow>
            )}
            {plants.map((plant) => (
              <TableRow key={plant.id}>
                <TableCell className="font-medium">{plant.name}</TableCell>
                <TableCell>{plant.variety ?? 'N/A'}</TableCell>
                <TableCell>{plant.latin_name ?? 'N/A'}</TableCell>
                <TableCell>{plant.is_organic ? 'Yes' : 'No'}</TableCell>
                <TableCell>{plant.avg_days_to_maturity ?? 'N/A'}</TableCell>
                <TableCell className="text-right">
                   <Button variant="ghost" size="icon" onClick={() => handleEdit(plant)} className="mr-2">
                       <Pencil className="h-4 w-4" />
                   </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(plant.id)} className="text-red-500 hover:text-red-700">
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