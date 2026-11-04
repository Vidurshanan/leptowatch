import { ChartFrame } from "@/components/charts/chart-frame";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PanelSkeleton } from "@/components/feedback/loading-skeleton";
import { MapFrame } from "@/components/maps/map-frame";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function ModulePlaceholder({
  moduleName,
  purpose,
  showMap = false,
}: {
  moduleName: string;
  purpose: string;
  showMap?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{moduleName} workspace</CardTitle>
            <CardDescription className="mt-1">{purpose}</CardDescription>
          </div>
          <Badge variant="muted">Phase 2 placeholder</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-background-deep px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coverage</p>
            <p className="mt-1 text-lg font-semibold text-cyan-bright">26 RDHS</p>
          </div>
          <div className="rounded-md border border-border bg-background-deep px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Alert display</p>
            <p className="mt-1 text-lg font-semibold text-watch">Watch layout</p>
          </div>
          <div className="rounded-md border border-amber/30 bg-amber/5 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-amber">Data quality</p>
            <p className="mt-1 text-lg font-semibold text-amber">UNVERIFIED</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace">
          <div className="grid gap-4 xl:grid-cols-5">
            <div className={showMap ? "xl:col-span-3" : "xl:col-span-3"}>
              {showMap ? <MapFrame /> : <ChartFrame title="Analytics panel" description="Chart chrome only." />}
            </div>
            <div className="xl:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Module notes</CardTitle>
                  <Badge variant="teal">Read-only</Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Dashboard modules</TableCell>
                        <TableCell className="text-amber">Deferred to Phase 4</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Live case counts</TableCell>
                        <TableCell className="text-muted-foreground">Not loaded</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Model inference</TableCell>
                        <TableCell className="text-muted-foreground">Disabled</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="states" className="grid gap-4 md:grid-cols-2">
          <EmptyState
            title="No module data bound yet"
            description="This empty state is part of the design system. Epidemiological tables will be connected in a later phase without fabricating values."
          />
          <ErrorState description="Example error treatment for missing files or failed reads. No production pipeline was invoked." />
          <div className="md:col-span-2 rounded-lg border border-border bg-surface p-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Loading skeleton</p>
            <PanelSkeleton />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { ModulePlaceholder };
