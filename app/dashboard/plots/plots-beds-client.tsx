'use client'; // Client component to manage multiple dialog states

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlotForm } from '@/components/forms/PlotForm';
import { BedForm } from '@/components/forms/BedForm'; // Import BedForm
import { deletePlot } from '@/app/actions/plots';
import { deleteBed } from '@/app/actions/beds'; // Import deleteBed action
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import { toast } from "sonner";

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type PlotWithBeds = Plot & { beds: Bed[] }; // Type from plots action

interface PlotsBedsClientProps {
  plotsWithBeds: PlotWithBeds[];
}

// Client Component for Plots & Beds Page
export function PlotsBedsClient({ plotsWithBeds }: PlotsBedsClientProps) {
  const [isPlotDialogOpen, setIsPlotDialogOpen] = useState(false);
  const [isBedDialogOpen, setIsBedDialogOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [currentPlotForBed, setCurrentPlotForBed] = useState<Plot | null>(null); // Track which plot we are adding/editing a bed for

  // --- Plot Handlers ---
  const handleEditPlot = (plot: Plot) => {
    setEditingPlot(plot);
    setIsPlotDialogOpen(true);
  };

  const handleAddPlot = () => {
    setEditingPlot(null);
    setIsPlotDialogOpen(true);
  };

  const handleDeletePlot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plot and ALL its beds?')) {
      return;
    }
    const result = await deletePlot(id);
    if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
      toast.error(result.message);
    } else {
      toast.success(result.message);
    }
  };

  const closePlotDialog = () => {
    setIsPlotDialogOpen(false);
    setEditingPlot(null);
  };

  // --- Bed Handlers ---
   const handleEditBed = (bed: Bed, plot: Plot) => {
    setEditingBed(bed);
    setCurrentPlotForBed(plot); // Need plot context for potential updates (though form only needs ID)
    setIsBedDialogOpen(true);
  };

  const handleAddBed = (plot: Plot) => {
    setEditingBed(null);
    setCurrentPlotForBed(plot); // Set the current plot context
    setIsBedDialogOpen(true);
  };

  const handleDeleteBed = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bed?')) {
      return;
    }
    const result = await deleteBed(id);
    if (result.message.startsWith('Database Error:') || result.message.startsWith('Error:')) {
      toast.error(result.message);
    } else {
      toast.success(result.message);
    }
  };

  const closeBedDialog = () => {
    setIsBedDialogOpen(false);
    setEditingBed(null);
    setCurrentPlotForBed(null);
  };

  // Create a simple list of all plots for the BedForm dropdown
  const allPlots = plotsWithBeds.map(({ beds: _beds, ...plot }) => plot);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Plots & Beds</h1>
        <Button onClick={handleAddPlot} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Plot
        </Button>
      </div>

      {/* Plot Add/Edit Dialog */}
      <Dialog open={isPlotDialogOpen} onOpenChange={setIsPlotDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingPlot ? 'Edit Plot' : 'Add New Plot'}</DialogTitle>
            <DialogDescription>
              {editingPlot ? 'Update the details of the plot.' : 'Enter the details for the new plot.'}
            </DialogDescription>
          </DialogHeader>
          <PlotForm plot={editingPlot} closeDialog={closePlotDialog} />
        </DialogContent>
      </Dialog>

      {/* Bed Add/Edit Dialog */}
      <Dialog open={isBedDialogOpen} onOpenChange={setIsBedDialogOpen}>
         <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingBed ? 'Edit Bed' : `Add New Bed to ${currentPlotForBed?.name ?? 'Plot'}`}</DialogTitle>
             <DialogDescription>
              {editingBed ? 'Update the details of the bed.' : 'Enter the details for the new bed.'}
            </DialogDescription>
          </DialogHeader>
           {/* Pass all plots for the dropdown, current bed for editing */}
          <BedForm bed={editingBed} plots={allPlots} closeDialog={closeBedDialog} />
        </DialogContent>
      </Dialog>

      {/* Display Plots and their Beds */}
      <div className="space-y-6">
        {plotsWithBeds.length === 0 && (
          <p className="text-center text-gray-500">No plots found. Add a plot to get started.</p>
        )}
        {plotsWithBeds.map((plot) => (
          <Card key={plot.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>{plot.name}</CardTitle>
                {plot.address && <p className="text-sm text-muted-foreground">{plot.address}</p>}
              </div>
              <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleAddBed(plot)} className="mr-2">
                      <PlusCircle className="h-4 w-4 mr-1" /> Add Bed
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEditPlot(plot)}>
                      <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeletePlot(plot.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plot.beds.length > 0 ? (
                <div className="border rounded-md">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bed Name</TableHead>
                      <TableHead>Length (in)</TableHead>
                      <TableHead>Width (in)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plot.beds.map((bed) => (
                      <TableRow key={bed.id}>
                        <TableCell className="font-medium">{bed.name}</TableCell>
                        <TableCell>{bed.length_in ?? '-'}</TableCell>
                        <TableCell>{bed.width_in ?? '-'}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => handleEditBed(bed, plot)}>
                                <Pencil className="h-4 w-4" />
                           </Button>
                           <Button variant="ghost" size="icon" onClick={() => handleDeleteBed(bed.id)} className="text-red-500 hover:text-red-700">
                               <Trash2 className="h-4 w-4" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-sm text-center text-gray-500 py-4">No beds added to this plot yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 