#!/bin/bash

# Update supabase imports to the new locations
grep -l "import.*from '@/src/lib/supabase'" --include="*.ts" --include="*.tsx" -r ./app ./src ./components | xargs sed -i '' -e "s|from '@/src/lib/supabase'|from '@/lib/supabase'|g"

# Update server-side imports
grep -l "import.*createSupabaseServerClient.*from '@/lib/supabase'" --include="*.ts" --include="*.tsx" -r ./app ./src ./components | xargs sed -i '' -e "s|from '@/lib/supabase'|from '@/lib/supabase-server'|g"

# Update route handler client imports
grep -l "import.*createSupabaseRouteHandlerClient.*from '@/lib/supabase'" --include="*.ts" --include="*.tsx" -r ./app ./src ./components | xargs sed -i '' -e "s|from '@/lib/supabase'|from '@/lib/supabase-server'|g"

# Update getUser/getUserSession imports
grep -l "import.*getUser.*from '@/lib/supabase'" --include="*.ts" --include="*.tsx" -r ./app ./src ./components | xargs sed -i '' -e "s|from '@/lib/supabase'|from '@/lib/supabase-server'|g"

# Update Database type imports (only if they also import server functions)
grep -l "import.*createSupabaseServerClient.*from '@/lib/supabase'" --include="*.ts" --include="*.tsx" -r ./app ./src ./components | grep -l "import.*Database.*from '@/lib/supabase'" | xargs sed -i '' -e "s|Database.*from '@/lib/supabase'|Database from '@/lib/supabase-server'|g"

# Note: We're keeping Tables/Enums types from the client file since they are duplicated
# If a file only imports these types, no changes needed 