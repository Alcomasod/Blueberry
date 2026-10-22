import { Request, Response } from 'express';
import {
    getAllCustomers,
    getCustomerByPhone,
    createCustomer,
    updateCustomer,
    deleteCustomer
} from '../services/customerService.js';

export async function handleGetAllCustomers(req: Request, res: Response) {
    try {
        const customers = await getAllCustomers();
        res.json({ success: true, data: customers });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch customers' });
    }
}

export async function handleGetCustomerByPhone(req: Request, res: Response) {
    const { phone } = req.params;

    try {
        const customer = await getCustomerByPhone(phone);
        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        res.json({ success: true, data: customer });
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch customer' });
    }
}

export async function handleCreateCustomer(req: Request, res: Response) {
    const { name, phone } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'name is required' });
    }

    try {
        const customer = await createCustomer(name, phone);
        res.status(201).json({ success: true, data: customer });
    } catch (error) {
        console.error('Error creating customer:', error);
        if ((error as Error).message.includes('unique')) {
            return res.status(400).json({ success: false, error: 'Phone number already exists' });
        }
        res.status(500).json({ success: false, error: 'Failed to create customer' });
    }
}

export async function handleUpdateCustomer(req: Request, res: Response) {
    const { id } = req.params;
    const { name, phone, points } = req.body;

    try {
        const customer = await updateCustomer(parseInt(id, 10), name, phone, points);
        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        res.json({ success: true, data: customer });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ success: false, error: 'Failed to update customer' });
    }
}

export async function handleDeleteCustomer(req: Request, res: Response) {
    const { id } = req.params;

    try {
        const success = await deleteCustomer(parseInt(id, 10));
        if (!success) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        res.json({ success: true, message: 'Customer deleted' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ success: false, error: 'Failed to delete customer' });
    }
}