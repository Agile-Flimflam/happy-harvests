'use client';

import { useState } from 'react';
import Fraction from 'fraction.js';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlotForm } from '../_components/PlotForm';
import { BedForm } from '../_components/BedForm';
import { deletePlot, deleteBed } from '../_actions';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import { toast } from "sonner";

type Plot = Tables<'plots'>;
type Bed = Tables<'beds'>;
type PlotWithBeds = Plot & { beds: Bed[] };

interface PlotsBedsPageContentProps {
  plotsWithBeds: PlotWithBeds[];
}

export function PlotsBedsPageContent({ plotsWithBeds }: PlotsBedsPageContentProps) {
  const [isPlotDialogOpen, setIsPlotDialogOpen] = useState(false);
  const [isBedDialogOpen, setIsBedDialogOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | null>(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [currentPlotForBed, setCurrentPlotForBed] = useState<Plot | null>(null);

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

  const handleEditBed = (bed: Bed, plot: Plot) => {
    setEditingBed(bed);
    setCurrentPlotForBed(plot);
    setIsBedDialogOpen(true);
  };

  const handleAddBed = (plot: Plot) => {
    setEditingBed(null);
    setCurrentPlotForBed(plot);
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

  const allPlots: Plot[] = plotsWithBeds;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Plots & Beds</h1>
        <Button onClick={handleAddPlot} size="sm">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Plot
        </Button>
      </div>

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

      <Dialog open={isBedDialogOpen} onOpenChange={setIsBedDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingBed ? 'Edit Bed' : `Add New Bed to ${currentPlotForBed?.name ?? 'Plot'}`}</DialogTitle>
            <DialogDescription>
              {editingBed ? 'Update the details of the bed.' : 'Enter the details for the new bed.'}
            </DialogDescription>
          </DialogHeader>
          <BedForm bed={editingBed} plots={allPlots} closeDialog={closeBedDialog} />
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {plotsWithBeds.length === 0 && (
          <p className="text-center text-gray-500">No plots found. Add a plot to get started.</p>
        )}
        {plotsWithBeds.map((plot) => {
          const totalSqFt = plot.beds.reduce((sum, bed) => {
            const length = bed.length_in;
            const width = bed.width_in;
            if (length && width && length > 0 && width > 0) {
              return sum + (length * width) / 144;
            }
            return sum;
          }, 0);
          const totalAcreage = totalSqFt / 43560;

          return (
            <Card key={plot.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>{plot.name}</CardTitle>
                  {plot.address && <p className="text-sm text-muted-foreground">{plot.address}</p>}
                  {totalAcreage > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total Acreage: {new Fraction(totalAcreage).toFraction(true)}
                    </p>
                  )}
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
                          <TableHead>Dimensions (in)</TableHead>
                          <TableHead>Sq Ft</TableHead>
                          <TableHead>Acres</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plot.beds.map((bed) => {
                          const areaSqIn = (bed.length_in && bed.width_in) ? bed.length_in * bed.width_in : null;
                          const areaSqFt = areaSqIn ? areaSqIn / 144 : null;
                          const acreage = areaSqFt ? areaSqFt / 43560 : null;
                          return (
                            <TableRow key={bed.id}>
                              <TableCell className="font-medium">{bed.name}</TableCell>
                              <TableCell>{`${bed.length_in ?? '?'} x ${bed.width_in ?? '?'}`}</TableCell>
                              <TableCell>{areaSqFt !== null ? areaSqFt.toFixed(0) : '-'}</TableCell>
                              <TableCell>{acreage !== null && acreage > 0 ? new Fraction(acreage).toFraction(true) : (acreage === 0 ? '0' : '-')}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleEditBed(bed, plot)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteBed(bed.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-center text-gray-500 py-4">No beds added to this plot yet.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


