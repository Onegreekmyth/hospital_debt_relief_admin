import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

const INITIAL_ROWS = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor' },
  { id: 3, name: 'Ali Khan', email: 'ali@example.com', role: 'Viewer' },
  { id: 4, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 5, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor' },
  { id: 6, name: 'Ali Khan', email: 'ali@example.com', role: 'Viewer' },
  { id: 7, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 8, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor' },
  { id: 9, name: 'Ali Khan', email: 'ali@example.com', role: 'Viewer' },
  { id: 10, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 11, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor' },
  { id: 12, name: 'Ali Khan', email: 'ali@example.com', role: 'Viewer' },
  { id: 13, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
];

// ----------------------------------------------------------------------

export function PageOneView() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('view'); // 'view' | 'edit' | 'create'
  const [currentRow, setCurrentRow] = useState(null);
  const [formValues, setFormValues] = useState({ name: '', email: '', role: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const isViewMode = dialogMode === 'view';
  const isEditMode = dialogMode === 'edit';
  const isCreateMode = dialogMode === 'create';

  const handleOpenDialog = (mode, row = null) => {
    setDialogMode(mode);
    setCurrentRow(row);
    if (row) {
      setFormValues({ name: row.name, email: row.email, role: row.role });
    } else {
      setFormValues({ name: '', email: '', role: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentRow(null);
  };

  const handleChangeField = (field) => (event) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSave = () => {
    if (!formValues.name || !formValues.email || !formValues.role) {
      return;
    }

    if (isEditMode && currentRow) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === currentRow.id ? { ...row, ...formValues } : row
        )
      );
    }

    if (isCreateMode) {
      const nextId = rows.length ? Math.max(...rows.map((row) => row.id)) + 1 : 1;
      setRows((prev) => [...prev, { id: nextId, ...formValues }]);
    }

    handleCloseDialog();
  };

  const handleDelete = (rowId) => {
    // Simple delete without extra confirmation dialog for now
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleChangeSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredRows = rows.filter((row) => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return (
      row.name.toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.role.toLowerCase().includes(query)
    );
  });

  const paginatedRows = filteredRows.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <DashboardContent maxWidth="xl">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4">Page one - CRUD example</Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search by name, email or role"
            value={searchQuery}
            onChange={handleChangeSearch}
          />

          <Button
            variant="contained"
            size="small"
            onClick={() => handleOpenDialog('create')}
          >
            Add row
          </Button>
        </Stack>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenDialog('view', row)}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenDialog('edit', row)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => handleDelete(row.id)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredRows.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Card>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isViewMode && 'View record'}
          {isEditMode && 'Edit record'}
          {isCreateMode && 'Add record'}
        </DialogTitle>

        <DialogContent dividers>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              mt: 1,
            }}
          >
            <TextField
              label="Name"
              size="small"
              value={formValues.name}
              onChange={handleChangeField('name')}
              InputProps={{ readOnly: isViewMode }}
              fullWidth
            />

            <TextField
              label="Email"
              size="small"
              type="email"
              value={formValues.email}
              onChange={handleChangeField('email')}
              InputProps={{ readOnly: isViewMode }}
              fullWidth
            />

            <TextField
              label="Role"
              size="small"
              value={formValues.role}
              onChange={handleChangeField('role')}
              InputProps={{ readOnly: isViewMode }}
              fullWidth
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          {(isEditMode || isCreateMode) && (
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}


