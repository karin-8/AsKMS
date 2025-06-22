import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, FileText, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [newDepartment, setNewDepartment] = useState({ name: "", description: "" });
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [isAssignPermissionOpen, setIsAssignPermissionOpen] = useState(false);

  // Fetch data
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const { data: departments = [], isLoading: deptLoading } = useQuery({
    queryKey: ["/api/admin/departments"],
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["/api/documents"],
  });

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ["/api/admin/permissions"],
  });

  // Mutations
  const createDepartmentMutation = useMutation({
    mutationFn: (dept) => apiRequest("/api/admin/departments", "POST", dept),
    onSuccess: () => {
      toast({ title: "สร้างแผนกสำเร็จ", description: "แผนกใหม่ถูกสร้างเรียบร้อยแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/departments"] });
      setIsCreateDeptOpen(false);
      setNewDepartment({ name: "", description: "" });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถสร้างแผนกได้", variant: "destructive" });
    },
  });

  const assignUserToDepartmentMutation = useMutation({
    mutationFn: ({ userId, departmentId }) => 
      apiRequest(`/api/admin/users/${userId}/department`, "PUT", { departmentId }),
    onSuccess: () => {
      toast({ title: "กำหนดแผนกสำเร็จ", description: "ผู้ใช้ถูกกำหนดแผนกเรียบร้อยแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถกำหนดแผนกได้", variant: "destructive" });
    },
  });

  const assignDocumentPermissionMutation = useMutation({
    mutationFn: (permission) => apiRequest("/api/admin/permissions", "POST", permission),
    onSuccess: () => {
      toast({ title: "กำหนดสิทธิ์สำเร็จ", description: "สิทธิ์เอกสารถูกกำหนดเรียบร้อยแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions"] });
      setIsAssignPermissionOpen(false);
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถกำหนดสิทธิ์ได้", variant: "destructive" });
    },
  });

  const removePermissionMutation = useMutation({
    mutationFn: (permissionId) => apiRequest(`/api/admin/permissions/${permissionId}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "ลบสิทธิ์สำเร็จ", description: "สิทธิ์เอกสารถูกลบเรียบร้อยแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permissions"] });
    },
    onError: () => {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบสิทธิ์ได้", variant: "destructive" });
    },
  });

  const handleCreateDepartment = () => {
    if (!newDepartment.name.trim()) {
      toast({ title: "กรุณากรอกชื่อแผนก", variant: "destructive" });
      return;
    }
    createDepartmentMutation.mutate(newDepartment);
  };

  const handleAssignDepartment = (userId, departmentId) => {
    assignUserToDepartmentMutation.mutate({ userId, departmentId });
  };

  const handleAssignPermission = (type, targetId, documentId, permission) => {
    const permissionData = {
      documentId,
      permission,
      ...(type === 'user' ? { userId: targetId } : { departmentId: targetId })
    };
    assignDocumentPermissionMutation.mutate(permissionData);
  };

  if (usersLoading || deptLoading || docsLoading) {
    return <div className="flex items-center justify-center h-64">กำลังโหลด...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">จัดการผู้ใช้ แผนก และสิทธิ์เอกสาร</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            ผู้ใช้
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            แผนก
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            สิทธิ์เอกสาร
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>รายการผู้ใช้</CardTitle>
              <CardDescription>จัดการผู้ใช้และกำหนดแผนก</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อผู้ใช้</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>แผนก</TableHead>
                    <TableHead>การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'destructive' : 'default'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.department ? (
                          <Badge variant="outline">{user.department.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">ไม่ได้กำหนด</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.departmentId?.toString() || ""}
                          onValueChange={(value) => 
                            handleAssignDepartment(user.id, value ? parseInt(value) : null)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="เลือกแผนก" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">ไม่กำหนดแผนก</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id.toString()}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>รายการแผนก</CardTitle>
                <CardDescription>จัดการแผนกต่าง ๆ ในองค์กร</CardDescription>
              </div>
              <Dialog open={isCreateDeptOpen} onOpenChange={setIsCreateDeptOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    สร้างแผนก
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>สร้างแผนกใหม่</DialogTitle>
                    <DialogDescription>
                      กรอกรายละเอียดแผนกใหม่
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="deptName">ชื่อแผนก</Label>
                      <Input
                        id="deptName"
                        value={newDepartment.name}
                        onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="เช่น IT, HR, การเงิน"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deptDesc">รายละเอียด</Label>
                      <Input
                        id="deptDesc"
                        value={newDepartment.description}
                        onChange={(e) => setNewDepartment(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="รายละเอียดแผนก"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateDepartment}
                      disabled={createDepartmentMutation.isPending}
                      className="w-full"
                    >
                      สร้างแผนก
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อแผนก</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead>จำนวนสมาชิก</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>{dept.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {users.filter(u => u.departmentId === dept.id).length} คน
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(dept.createdAt).toLocaleDateString('th-TH')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>สิทธิ์เอกสาร</CardTitle>
                <CardDescription>จัดการสิทธิ์การเข้าถึงเอกสาร (Many-to-Many)</CardDescription>
              </div>
              <Dialog open={isAssignPermissionOpen} onOpenChange={setIsAssignPermissionOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    กำหนดสิทธิ์
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>กำหนดสิทธิ์เอกสาร</DialogTitle>
                    <DialogDescription>
                      เลือกเอกสารและกำหนดสิทธิ์ให้ผู้ใช้หรือแผนก
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>เลือกเอกสาร</Label>
                      <Select onValueChange={(value) => setSelectedDocument(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกเอกสาร" />
                        </SelectTrigger>
                        <SelectContent>
                          {documents.map((doc) => (
                            <SelectItem key={doc.id} value={doc.id.toString()}>
                              {doc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>ประเภทการกำหนดสิทธิ์</Label>
                      <Tabs defaultValue="user" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="user">ผู้ใช้รายบุคคล</TabsTrigger>
                          <TabsTrigger value="department">แผนก</TabsTrigger>
                        </TabsList>
                        <TabsContent value="user" className="space-y-3">
                          <Label>เลือกผู้ใช้</Label>
                          <Select onValueChange={(value) => setSelectedUser(value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกผู้ใช้" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.firstName} {user.lastName} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            onClick={() => handleAssignPermission('user', selectedUser, selectedDocument, 'read')}
                            disabled={!selectedUser || !selectedDocument}
                            className="w-full"
                          >
                            กำหนดสิทธิ์อ่าน
                          </Button>
                        </TabsContent>
                        <TabsContent value="department" className="space-y-3">
                          <Label>เลือกแผนก</Label>
                          <Select onValueChange={(value) => setSelectedUser(value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกแผนก" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id.toString()}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button 
                            onClick={() => handleAssignPermission('department', selectedUser, selectedDocument, 'read')}
                            disabled={!selectedUser || !selectedDocument}
                            className="w-full"
                          >
                            กำหนดสิทธิ์อ่าน
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">สิทธิ์ผู้ใช้รายบุคคล</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เอกสาร</TableHead>
                        <TableHead>ผู้ใช้</TableHead>
                        <TableHead>สิทธิ์</TableHead>
                        <TableHead>การดำเนินการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.filter(p => p.userId).map((permission) => (
                        <TableRow key={permission.id}>
                          <TableCell className="font-medium">
                            {documents.find(d => d.id === permission.documentId)?.name || 'ไม่พบเอกสาร'}
                          </TableCell>
                          <TableCell>
                            {users.find(u => u.id === permission.userId)?.firstName} {users.find(u => u.id === permission.userId)?.lastName}
                          </TableCell>
                          <TableCell>
                            <Badge>{permission.permission}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removePermissionMutation.mutate(permission.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">สิทธิ์แผนก</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เอกสาร</TableHead>
                        <TableHead>แผนก</TableHead>
                        <TableHead>สิทธิ์</TableHead>
                        <TableHead>การดำเนินการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.filter(p => p.departmentId).map((permission) => (
                        <TableRow key={permission.id}>
                          <TableCell className="font-medium">
                            {documents.find(d => d.id === permission.documentId)?.name || 'ไม่พบเอกสาร'}
                          </TableCell>
                          <TableCell>
                            {departments.find(d => d.id === permission.departmentId)?.name || 'ไม่พบแผนก'}
                          </TableCell>
                          <TableCell>
                            <Badge>{permission.permission}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removePermissionMutation.mutate(permission.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}