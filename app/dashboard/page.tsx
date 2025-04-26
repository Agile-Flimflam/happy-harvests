import { createSupabaseServerClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, Sprout, Tractor } from 'lucide-react'; // Using Tractor for Plots count, removed Fence

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();

  // Fetch counts in parallel
  const { count: cropVarietyCount, error: cropVarietyError } = await supabase
    .from('plants')
    .select('*', { count: 'exact', head: true });

  const { count: plotCount, error: plotError } = await supabase
    .from('plots')
    .select('*', { count: 'exact', head: true });

  const { 'count': cropCount, error: cropError } = await supabase
    .from('crops')
    .select('*', { count: 'exact', head: true });

  if (cropVarietyError || plotError || cropError) {
      console.error('Error fetching counts:', { cropVarietyError, plotError, cropError });
      // Handle error display appropriately, maybe show partial data or an error message
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Crop Varieties</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cropVarietyCount ?? 'N/A'}</div>
            {cropVarietyError && <p className="text-xs text-red-500">Error loading</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plots</CardTitle>
            <Tractor className="h-4 w-4 text-muted-foreground" /> {/* Using Tractor icon */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plotCount ?? 'N/A'}</div>
             {plotError && <p className="text-xs text-red-500">Error loading</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Crops</CardTitle>
            <Sprout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cropCount ?? 'N/A'}</div>
             {cropError && <p className="text-xs text-red-500">Error loading</p>}
          </CardContent>
        </Card>
      </div>
       {/* Add more dashboard elements here as needed */}
    </div>
  );
} 